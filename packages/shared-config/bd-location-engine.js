const divisionsData = require('./data/divisions.json');
const districtsData = require('./data/districts.json');
const upazilasData = require('./data/upazilas.json');
const BENGALI_NUMBER_MAP = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

const normalizeLocationText = (text) => {
  if (!text) return "";
  let out = String(text).replace(/[০-৯]/g, (match) => BENGALI_NUMBER_MAP[match] || match).toLowerCase();
  out = out.replace(/[\/_.,]+/g, " ");
  out = out.replace(/[-]+/g, " ");
  out = out.replace(/([a-z\u0980-\u09FF])(\d)/g, "$1 $2");
  out = out.replace(/(\d)([a-z\u0980-\u09FF])/g, "$1 $2");
  out = out.replace(/\b0+(\d)\b/g, "$1");
  out = out.replace(/\s+/g, " ").trim();
  return out;
};

class BDLocationEngine {
  constructor() {
    this.divisions = divisionsData;
    this.districts = districtsData;
    this.upazilas = upazilasData;

    // Build Maps for fast O(1) lookups
    this.districtMap = new Map(this.districts.map(d => [d.id, d]));
    this.divisionMap = new Map(this.divisions.map(d => [d.id, d]));
    
    // Reverse Map for Hierarchy
    this.districtsByDivision = new Map();
    this.districts.forEach(d => {
      if (!this.districtsByDivision.has(d.divisionId)) {
        this.districtsByDivision.set(d.divisionId, []);
      }
      this.districtsByDivision.get(d.divisionId).push(d);
    });

    this.upazilasByDistrict = new Map();
    this.upazilas.forEach(u => {
      if (!this.upazilasByDistrict.has(u.districtId)) {
        this.upazilasByDistrict.set(u.districtId, []);
      }
      this.upazilasByDistrict.get(u.districtId).push(u);
    });

    // Build flat normalized alias index
    this.aliasIndex = [];
    
    this.divisions.forEach(d => {
      this._addIndex(d.name, { type: 'division', id: d.id, obj: d });
      this._addIndex(d.bnName, { type: 'division', id: d.id, obj: d });
    });
    this.districts.forEach(d => {
      this._addIndex(d.name, { type: 'district', id: d.id, obj: d });
      this._addIndex(d.bnName, { type: 'district', id: d.id, obj: d });
    });
    this.upazilas.forEach(u => {
      this._addIndex(u.name, { type: 'thana', id: u.id, obj: u });
      this._addIndex(u.bnName, { type: 'thana', id: u.id, obj: u });
      // Thana alias (e.g. "Sadar") combined with district is often queried
      if (u.name.toLowerCase().includes('sadar')) {
        const dist = this.districtMap.get(u.districtId);
        if (dist) {
          this._addIndex(`${dist.name} sadar`, { type: 'thana', id: u.id, obj: u });
          this._addIndex(`${dist.bnName} সদর`, { type: 'thana', id: u.id, obj: u });
        }
      }
    });
  }

  _addIndex(text, data) {
    if (!text) return;
    const normalized = normalizeLocationText(text);
    if (!normalized) return;
    this.aliasIndex.push({
      key: normalized,
      tokens: normalized.split(' '),
      data
    });
  }

  getDivisions() {
    return this.divisions;
  }

  getDistricts(divisionId = null) {
    if (divisionId) {
      return this.districtsByDivision.get(Number(divisionId)) || [];
    }
    return this.districts;
  }

  getUpazilas(districtId = null) {
    if (districtId) {
      return this.upazilasByDistrict.get(Number(districtId)) || [];
    }
    return this.upazilas;
  }

  getHierarchyFromThana(thanaId) {
    const thana = this.upazilas.find(u => u.id === Number(thanaId));
    if (!thana) return null;
    const district = this.districtMap.get(thana.districtId);
    const division = district ? this.divisionMap.get(district.divisionId) : null;
    return { division, district, thana };
  }

  getHierarchyFromDistrict(districtId) {
    const district = this.districtMap.get(Number(districtId));
    if (!district) return null;
    const division = this.divisionMap.get(district.divisionId);
    return { division, district, thana: null };
  }

  /**
   * Search for the best matching location from text
   */
  resolveLocation(query) {
    if (!query) return null;
    const normalizedQuery = normalizeLocationText(query);
    if (!normalizedQuery) return null;

    const queryTokens = normalizedQuery.split(' ');

    let bestMatch = null;
    let maxScore = 0;

    for (const entry of this.aliasIndex) {
      // Exact match
      if (entry.key === normalizedQuery) {
        return this._buildResolveResult(entry.data, 100);
      }

      // Token inclusion matching
      let score = 0;
      let matchedTokens = 0;
      for (const t of entry.tokens) {
        if (queryTokens.includes(t)) {
          matchedTokens++;
          score += t.length;
        }
      }

      // Bonus if it's an exact token match
      if (matchedTokens === entry.tokens.length) {
        score += 20;
      }

      // Penalize if it's just a generic word match that isn't full
      if (matchedTokens > 0 && score > maxScore) {
        maxScore = score;
        bestMatch = entry;
      }
    }

    if (bestMatch && maxScore > 3) { // min threshold
      return this._buildResolveResult(bestMatch.data, maxScore);
    }

    return null;
  }

  _getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  reverseGeocode(lat, lng) {
    if (!lat || !lng) return null;

    // Find closest district
    let closestDistrict = null;
    let minDistance = Infinity;

    for (const d of this.districts) {
      if (d.coordinates && d.coordinates.latitude) {
        const dist = this._getDistance(lat, lng, d.coordinates.latitude, d.coordinates.longitude);
        if (dist < minDistance) {
          minDistance = dist;
          closestDistrict = d;
        }
      }
    }

    if (!closestDistrict) return null;

    const division = this.divisionMap.get(closestDistrict.divisionId);
    
    return {
      division: division?.name,
      district: closestDistrict.name,
      districtId: closestDistrict.id
    };
  }

  _buildResolveResult(data, score) {
    const result = { score, type: data.type };
    if (data.type === 'thana') {
      const h = this.getHierarchyFromThana(data.id);
      result.division = h.division?.name;
      result.district = h.district?.name;
      result.thana = h.thana?.name;
      result.coordinates = h.district?.coordinates || h.division?.coordinates; // fallback
      result.thanaObj = h.thana;
    } else if (data.type === 'district') {
      const h = this.getHierarchyFromDistrict(data.id);
      result.division = h.division?.name;
      result.district = h.district?.name;
      result.coordinates = h.district?.coordinates;
    } else {
      result.division = data.obj.name;
      result.coordinates = data.obj.coordinates;
    }
    return result;
  }
}

// Singleton
const engine = new BDLocationEngine();
module.exports = engine;
