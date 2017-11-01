var passport = require('passport')
var api = require('../api')

const router = require('express-promise-router')()

const bearerAuth = () => {
    return passport.authenticate('bearer', {
        failWithError: true,
        session: false
    })
}

router.post('/login', passport.authenticate('local'), function(req, res) {
    return api.Token.createLogin(req.user)
        .then((t) => {
            res.json({
                token: t.token,
                expires: Math.round(t.expires / 1000),
                user: req.user,
            })
        })
})

const logout = (req, res) => {
    return api.models.Token.remove({ _id: req.authInfo.token._id })
        .then(() => {
            req.logout()
            res.status(202).send()
        })
}

router.delete('/login', bearerAuth(), logout)
router.get('/logout', bearerAuth(), logout)

router.get('/refresh', bearerAuth(), function(req, res){
    return api.models.Token.remove({ _id: req.authInfo.token._id })
        .then(() => api.Token.createLogin(req.user))
        .then((t) => {
            res.json({
                token: t.token,
                expires: t.expires
            })
        })
})

router.get('/me', bearerAuth(), function(req, res) {
    res.json(req.user)
    return Promise.resolve()
})

module.exports = router
