//define secret key (same as in passport.js) 
const jwtSecret = "your_jwt_secret";

const jwt = require('jsonwebtoken'),
    passport = require('passport');

require('./passport');

let generateJWTToken = (user) => {
    return jwt.sign(user, jwtSecret, {
        subject: user.Username,  //username being encoded in JWT
        expiresIn: '7d',
        algorithm: 'HS256' //algorithm used to “sign” or encode the values of the JWT
    });
}

/**
 * Endpoint authenticates and logs a registered user in using the POST method.
 * @returns If successful, it will return a JSON object listing all the user data and their issued JWT to provide access to the rest of the site.
 */ 
module.exports = (router) => {
    router.post('/login', (req, res) => {
        passport.authenticate('local', { session: false }, (error, user, info) => {
            if (error || !user ) {
                console.log(error);
                return res.status(400).json({
                    message: 'Something is not right',
                    user: user
                });
            }
            req.login(user, { session: false }, (error) => {
                if (error) {
                    res.send(error);
                }
                let token = generateJWTToken(user.toJSON());
                return res.json({ user, token });
            });
        })(req, res);
    });
}