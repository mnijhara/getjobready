// Canonical production entrypoint. Keeping this tiny wrapper prevents the deployment
// pipeline from accidentally reusing a stale legacy HTML entry module.
import './getjobready-cloud.js';
import './main-v2.jsx';
