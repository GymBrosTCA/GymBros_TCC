// requirePlanLevel.js — restringe rotas por plano do usuário
// planoId: 'pl001' = Starter | 'pl002' = GymBro | 'pl003' = Black
function requirePlanLevel(allowedIds) {
    return (req, res, next) => {
        const userPlanoId = req.session.user?.planoId;
        if (!allowedIds.includes(userPlanoId)) {
            return res.redirect('/meu-plano?upgrade=1');
        }
        next();
    };
}

module.exports = requirePlanLevel;
