'use strict';

// planoSlug: 'starter' | 'gymbro' | 'black'
function requirePlanLevel(slugs) {
    return (req, res, next) => {
        const userSlug = req.session.user?.planoSlug;
        if (!slugs.includes(userSlug)) {
            return res.redirect('/meu-plano?upgrade=1');
        }
        next();
    };
}

module.exports = requirePlanLevel;
