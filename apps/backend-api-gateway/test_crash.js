const axios = require("axios");
axios.get("http://localhost:8001/api/listings/search?q=!@#$%^&* sylhet")
  .then(res => console.log("Success"))
  .catch(err => console.error(err.message));
