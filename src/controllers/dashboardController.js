const { getComplianceOverview } = require('../services/dashboardService');

async function complianceOverview(req, res) {
  const overview = await getComplianceOverview(req.accessScope);
  res.json(overview);
}

module.exports = { complianceOverview };
