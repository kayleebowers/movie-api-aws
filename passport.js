const passport = require("passport"),
  LocalStrategy = require("passport-local").Strategy,
  Models = require("./models.js"),
  passportJWT = require("passport-jwt");

let Users = Models.User,
  JWTStrategy = passportJWT.Strategy,
  ExtractJWT = passportJWT.ExtractJwt;

//define basic HTTP authentication for login requests
passport.use(
  new LocalStrategy(
    {
      usernameField: "Username",
      passwordField: "Password",
    },
    (username, password, callback) => {
      console.log(username + " " + password);
      //verify that user exists in database
      Users.findOne({ Username: username })
        .then((user) => {
          //check for valid user
          if (!user) {
            console.log("Incorrect username");
            return callback(null, false, { message: "Incorrect username" });
          }
          //check for valid hashed password
          if (!user.validatePassword(password)) {
            console.log("Incorrect password");
            return callback(null, false, { message: "Incorrect password" });
          }
          console.log("finished");
          return callback(null, user);
        })
        .catch((error) => {
          console.log(error);
          return callback(error);
        });
    }
  )
);

//authenticate users based on the JWT submitted alongside their request
passport.use(
  new JWTStrategy(
    {
      //get JWT from HTTP header
      jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
      secretOrKey: "your_jwt_secret",
    },
    //act on claims in JWT
    (jwtPayload, callback) => {
      return Users.findById(jwtPayload._id)
        .then((user) => {
          return callback(null, user);
        })
        .catch((error) => {
          return callback(error);
        });
    }
  )
);
