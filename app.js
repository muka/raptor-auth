const express = require('express')
const bodyParser = require('body-parser')
const passport = require('passport')

const BasicStrategy = require('passport-http').BasicStrategy
const LocalStrategy = require('passport-local').Strategy
const BearerStrategy = require('passport-http-bearer').Strategy
const ClientPasswordStrategy = require('passport-oauth2-client-password').Strategy

const errors = require('./errors')
const logger = require('./logger')

const routes = require('./routes/index')
const api = require('./api')

const app = express()

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use(passport.initialize())

//generate API docs
app.get('/swagger.json', function(req, res) {
    res.json(require('./swagger')())
})

app.post('/auth/oauth/access_token', require('./oauth2').token)


const credentialsLogin = function(username, password, done) {
    api.models.User.findOne({ username: username }, function (err, user) {
        if (err) {
            return done(err)
        }
        if (!user) {
            return done(null, false)
        }
        api.models.User.validPassword(password, user.password)
            .then((valid) => {
                if(!valid) {
                    return done(null, false)
                }
                done(null, user)
            })
            .catch((e) => {
                done(e, false)
            })
    })
}

// passport config
passport.use(new BasicStrategy(credentialsLogin))
passport.use(new LocalStrategy(credentialsLogin))
passport.use(new ClientPasswordStrategy(function(clientId, clientSecret, done) {
    api.models.Client.findOne({ id: clientId, secret: clientSecret }, function (err, client) {
        if (err) {
            return done(err)
        }
        if (!client) {
            return done(null, false)
        }
        if (!client.enabled) {
            return client
        }
        return done(null, client)
    })
}
))
passport.use(new BearerStrategy(function(t, done) {
    return api.models.Token.findOne({ token: t })
        .then((token) => {

            if (!token) {
                return done(null, false)
            }

            if (token.isExpired()) {
                return api.models.Token.remove({ _id: token._id })
                    .then(() => {
                        return Promise.reject(new errors.BadRequest('Token is expired'))
                    })
            }

            return api.models.User.findOne({ uuid: token.userId})
                .then((user) => {

                    if(user === null) {
                        return done(null, false)
                    }

                    if(!user.enabled) {
                        return done(null, false)
                    }

                    done(null, user, { token })
                })
        })
        .catch((e) => done(e, false))
}))

passport.serializeUser(function(user, done) {
    done(null, user._id)
})

passport.deserializeUser(function(id, done) {
    api.models.User.findById(id)
        .then((user) => {
            done(null, user)
        })
        .catch((err) => {
            done(err, null)
        })
})


for (const path in routes) {

    const isRoot = path === ''
    const subpath = isRoot ? '' : `/${path}`
    const subrouter = require('express-promise-router')()

    // check token only on subpath like user, role, token
    if(!isRoot) {
        subrouter.use(passport.authenticate('bearer', {
            failWithError: true,
            session: false
        }))
        subrouter.use(require('./authz').check({ type: path }))
    }
    routes[path].router(subrouter)

    app.use(`/auth${subpath}`, subrouter)
}

// last call catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(new errors.NotFound())
})

// error handlers
app.use(function(err, req, res, next) {

    if(err.message === 'Unauthorized') {
        err = new errors.Unauthorized()
    }

    if(!(err instanceof errors.BaseError)) {
        logger.error(err)
    }

    err.code = err.code || 500
    res.status(err.code)
    res.json({
        message: err.message,
        code: err.code,
    })
})

module.exports = app
