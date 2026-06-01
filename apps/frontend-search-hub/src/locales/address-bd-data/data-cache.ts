/**
 * Centralized Data Cache
 * Prevents duplication by storing raw data and entity instances in a singleton
 */

import { Division } from '../address/entities/division.entity';
import { District } from '../address/entities/district.entity';
import { Upazila } from '../address/entities/upazila.entity';
import divisionsJson from './divisions.json';
import districtsJson from './districts.json';
import upazilasJson from './upazilas.json';

type DivisionData = typeof divisionsJson;
type DistrictData = typeof districtsJson;
type UpazilaData = typeof upazilasJson;

class DataCache {
    private static instance?: DataCache;

    // Raw data (lightweight)
    private readonly _rawDivisions: DivisionData;
    private readonly _rawDistricts: DistrictData;
    private readonly _rawUpazilas: UpazilaData;

    // Entity instances (lazy-loaded)
    private _divisionEntities?: Division[];
    private _districtEntities?: District[];
    private _upazilaEntities?: Upazila[];

    private constructor() {
        this._rawDivisions = divisionsJson;
        this._rawDistricts = districtsJson;
        this._rawUpazilas = upazilasJson;
    }

    static getInstance(): DataCache {
        if (!this.instance) {
            this.instance = new DataCache();
        }
        return this.instance;
    }

    // Access entity instances (lazy-loaded)
    get divisionEntities(): Division[] {
        if (!this._divisionEntities) {
            this._divisionEntities = this._rawDivisions.map(
                (d) => new Division(d)
            );
        }
        return this._divisionEntities;
    }

    get districtEntities(): District[] {
        if (!this._districtEntities) {
            this._districtEntities = this._rawDistricts.map(
                (d) => new District(d)
            );
        }
        return this._districtEntities;
    }

    get upazilaEntities(): Upazila[] {
        if (!this._upazilaEntities) {
            this._upazilaEntities = this._rawUpazilas.map(
                (u) => new Upazila(u)
            );
        }
        return this._upazilaEntities;
    }

    reset(): void {
        this._divisionEntities = undefined;
        this._districtEntities = undefined;
        this._upazilaEntities = undefined;
    }
}

export const dataCache = DataCache.getInstance();
