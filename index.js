const express = require("express"),
  mongoose = require("mongoose"),
  models = require("./models.js"),
  morgan = require("morgan"),
  fs = require("fs"),
  uuid = require("uuid"),
  bodyParser = require("body-parser"),
  path = require("path");
const {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
require("dotenv").config();
const multer = require("multer");
const multerS3 = require("multer-s3");

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const app = express(),
  /**
   * declare models
   */
  Movies = models.Movie,
  Users = models.User;

/**
 * set up bodyParser
 */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// require cors to allow requests from all origins by default
const cors = require("cors");
app.use(cors());

// require express-validator
const { check, validationResult } = require("express-validator");

/**
 * require auth and passport
 */
let auth = require("./auth")(app);
const passport = require("passport");
require("./passport");

/**
 * connect mongoose to online database
 */
mongoose.connect(
  "mongodb+srv://MoviesDBAdmin:9KUlkRsXODIUf0mv@moviesdb.ybzyezj.mongodb.net/myFlixDB?retryWrites=true&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

/**
 * create write stream
 */
const logStream = fs.createWriteStream(path.join(__dirname, "log.txt"), {
  flags: "a",
});

/**
 * use Morgan to log requests to server
 */
app.use(morgan("common", { stream: logStream }));
// app.use(fileUpload());

// AWS config and endpoints
const s3Client = new S3Client({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: "us-east-1",
});

const listOriginalPhotosParams = {
  Bucket: "cf-thumbnail-bucket",
};

const listThumbnailResizesParams = {
  Bucket: "cf-2-5-lambda-bucket",
};

listObjectsCmd = new ListObjectsV2Command(listOriginalPhotosParams);
s3Client.send(listObjectsCmd);

// get original images
app.get("/images", (req, res) => {
  listOriginalPhotosParams;
  s3Client
    .send(new ListObjectsV2Command(listOriginalPhotosParams))
    .then((listObjectsResponse) => {
      res.setHeader("Content-Type", "application/json");
      res.json(listObjectsResponse);
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: "The image get isn't working" });
    });
});

// get resized thumbnails
app.get("/thumbnails", (req, res) => {
  listThumbnailResizesParams;
  s3Client
    .send(new ListObjectsV2Command(listThumbnailResizesParams))
    .then((listObjectsResponse) => {
      res.setHeader("Content-Type", "application/json");
      res.json(listObjectsResponse);
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: "The image get isn't working" });
    });
});

const storage = multer.memoryStorage(); // Store the file in memory
const upload = multer({ storage });

// post image to AWS bucket
app.post("/images", upload.single("file"), async (req, res) => {
  // Check if file is present
  if (!req.file) {
    return res.status(400).send("No file was uploaded.");
  }

  const file = req.file;
  const fileName = file.originalname;

  try {
    // Set up parameters for S3 upload
    const params = {
      Bucket: "cf-thumbnail-bucket",
      Key: `${fileName}`,
      Body: file.buffer,
      ContentType: "image/png",
    };

    // Upload to S3
    const uploadResult = await s3Client.send(new PutObjectCommand(params));
    console.log("File uploaded", uploadResult);
  } catch (err) {
    console.error(`Error resizing image: ${err}`);
  }

});

// get single original image
app.get("/images/:key", async (req, res) => {
  const key = req.params.key;
  try {
    const { Body, ContentType } = await s3Client.send(
      new GetObjectCommand({
        Bucket: "cf-thumbnail-bucket",
        Key: key,
      })
    );

    // Set the appropriate headers for image response
    res.setHeader("Content-Type", ContentType);

    // Pipe the image data directly to the response
    Body.pipe(res);
  } catch (err) {
    console.log(err);
    res.status(500).send("Error retrieving object from S3");
  }
});

/**
 * Endpoint returns a list of ALL movies to the user using the GET method.
 * @example Using `https://movies-app1-3d6bd65a6f09.herokuapp.com/movies` will return an array of movie objects in JSON format.
 * The URL endpoint is `/movies`.
 */
app.get("/movies", (req, res) => {
  Movies.find()
    .then((movies) => {
      res.status(201).json(movies);
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send("Error: " + error);
    });
});

/**
 * Endpoint returns a movie's data using the GET method.
 * @param The parameter is a movie title written without quotation marks to form the URL endpoint is `/movies/:title`.
 * @example An example of the URL with the parameter is `https://movies-app1-3d6bd65a6f09.herokuapp.com/movies/Spirited%20Away`.
 */
app.get(
  "/movies/:title",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    Movies.findOne({ Title: req.params.title })
      .then((movie) => {
        res.json(movie);
      })
      .catch((error) => {
        console.error(error);
        res.status(500).send("Error: " + error);
      });
  }
);

/**
 * Endpoint returns data about a movie's genre by name using the GET method.
 * @param name
 * The parameter is a genre name to form the URL endpoint is `/genres/:name`.
 * @example An example of the URL with the parameter is `https://movies-app1-3d6bd65a6f09.herokuapp.com/genres/Drama`, which would return the response, "In film and television, drama is a category or genre of narrative fiction (or semi-fiction) intended to be more serious than humorous in tone."
 */
app.get(
  "/genres/:name",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    Movies.find({ "Genre.Name": req.params.name })
      .then((movie) => {
        res.status(200).json(movie[0].Genre["Description"]);
      })
      .catch((error) => {
        console.error(error);
        res.status(500).send("Error: " + error);
      });
  }
);

/**
 * Endpoint returns data about a movie's director by name using the GET method.
 * @param name
 * The parameter is a director's name to form the URL endpoint is `/directors/:name`.
 * @example An example of the URL with the parameter is `https://movies-app1-3d6bd65a6f09.herokuapp.com/directors/Steven%20Spielberg`, which would return a JSON object with Steven Spielberg's information.
 */
app.get(
  "/directors/:name",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    Movies.findOne({ "Director.Name": req.params.name })
      .then((movie) => {
        res.status(200).json(movie.Director);
      })
      .catch((error) => {
        console.error(error);
        res.status(400).send("Error: " + error);
      });
  }
);

/**
 * Endpoint registers a new user after receiving a valid request body using the POST method.
 * No parameter is used, but the response body must be a JSON object in the following format: `{ "Username": String, "Password": String, "Email": String, "Birthday": Date }`.
 * @example An example of a valid entry is: `{ "Username": "NewUser", "Password": "543", "Email": "new@email.com", "Birthday": "1960-04-29" }`.
 */
app.post(
  "/users",
  /**
   * validate inputs on server side
   */
  [
    check(
      "Username",
      "Username must be at least 5 characters and can only use alphanumeric characters"
    )
      .isAlphanumeric()
      .isLength({ min: 5 }),
    check("Password", "Password is required").not().isEmpty(),
    check("Email", "Valid email is required").not().isEmpty().isEmail(),
  ],
  (req, res) => {
    /**
     * check validation object for errors
     */
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    let hashedPassword = Users.hashPassword(req.body.Password);
    Users.findOne({ Username: req.body.Username })
      /**
       * check if user already exists
       */
      .then((user) => {
        if (user) {
          return res.status(400).send(req.body.Username + " already exists");
        } else {
          Users.create({
            Username: req.body.Username,
            Password: hashedPassword,
            Email: req.body.Email,
            Birthday: req.body.Birthday,
          })
            .then((user) => {
              res.status(201).json(user);
            })
            .catch((error) => {
              console.error(error);
              res.status(500).send("Error: " + error);
            });
        }
      })
      .catch((error) => {
        console.error(error);
        res.status(500).send("Error: " + error);
      });
  }
);

/**
 * Endpoint return's a single user's data using the GET method.
 * @param id
 * The endpoint must receive a user ID to make up the URL endpoint `/users/:id`.
 * @example The URL `https://movies-app1-3d6bd65a6f09.herokuapp.com/users/649a271eef2156d71e630260` would return a JSON object with this format `{ "Username": "existingUser", "Password": "testing", "Email": "test@email.com", "Birthday": "2023-09-09" }`.
 */
app.get(
  "/users/:id",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    Users.findOne({ _id: req.params.id })
      .then((user) => {
        res.status(200).json(user);
      })
      .catch((error) => {
        console.error(error);
        res.status(400).send("Error: " + error);
      });
  }
);

/**
 * Endpoint updates a single user's data using the PUT method.
 * The endpoint must have a user ID to make up the URL endpoint `/users/:id`, as well as a JSON request body in this format `{ Username: String (required), Password: String (required), Email: String (required), Birthday: Date }`.
 * @example The URL `https://movies-app1-3d6bd65a6f09.herokuapp.com/users/649a271eef2156d71e630260` might return an updated user object in this format: `{ "Username": "updatedUser", "Password": "updateMe", "Email": "update@email.com", "Birthday": "2013-09-09" }`.
 */
app.put(
  "/users/:id",
  passport.authenticate("jwt", { session: false }),
  /**
   * validate user input in req body
   */
  [
    check(
      "Username",
      "Username must contain at least 5 characters that are all alphanumeric"
    )
      .isAlphanumeric()
      .isLength({ min: 5 }),
    check("Password", "Password is required").not().isEmpty(),
    check("Email", "Must use valid email").isEmail(),
    check("Birthday", "Date must be valid").isDate(),
  ],
  (req, res) => {
    /**
     * check validation object for errors
     */
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    let hashedPassword = Users.hashPassword(req.body.Password);

    Users.findOneAndUpdate(
      { _id: req.params.id },
      {
        $set: {
          Username: req.body.Username,
          Password: hashedPassword,
          Email: req.body.Email,
          Birthday: req.body.Birthday,
        },
      },
      { new: true }
    )
      .then((updatedUser) => {
        if (!updatedUser) {
          return res.status(404).send("Error: User doesn't exist");
        } else {
          res.json(updatedUser);
        }
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send("Error: " + err);
      });
  }
);

/**
 * Endpoint allows users to add a movie to their list of favorites using the POST method.
 * @param id
 * @param movieId
 * The requesting URL must have a user ID and a movie ID to make up the endpoint `/users/:id/movies/:movieId`.
 * @example The example `https://movies-app1-3d6bd65a6f09.herokuapp.com/users/CoolKid/movies/649a271eef2156d71e630260` would return a JSON object displaying all of the user CoolKid's data, along with their new favorite movie in the Favorites array.
 */
app.post(
  "/users/:id/movies/:movieId",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    Users.findOneAndUpdate(
      { _id: req.params.id },
      {
        $push: { Favorites: req.params.movieId },
      },
      { new: true }
    )
      .then((updatedUser) => {
        if (!updatedUser) {
          return res.status(400).send("User not found");
        } else {
          res.status(201).json(updatedUser);
        }
      })
      .catch((error) => {
        console.error(err);
        res.status(500).send("Error: " + err);
      });
  }
);

/**
 * Endpoint allows users to remove a movie from their list of favorites using the DELETE method.
 * @param id
 * @param movieId
 * The requesting URL must have a user ID and a movie ID to make up the endpoint `/users/:id/movies/:movieId`.
 * @example The example `https://movies-app1-3d6bd65a6f09.herokuapp.com/users/CoolKid/movies/649a271eef2156d71e630260` would return a JSON object displaying all of the user CoolKid's data, along with their shorter (or empty) Favorites array.
 * A successful response will return a text message saying the movie has been removed.
 */
app.delete(
  "/users/:id/movies/:movieId",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    Users.findOneAndUpdate(
      { _id: req.params.id },
      {
        $pull: { Favorites: req.params.movieId },
      },
      { new: true }
    )
      .then((updatedUser) => {
        if (!updatedUser) {
          return res.status(400).send("User not found");
        } else {
          res.status(201).json(updatedUser);
        }
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send("Error: " + err);
      });
  }
);

/**
 * Endpoint deletes a single user's data using the DELETE method.
 * @param id
 * The endpoint must have a user ID to make up the URL endpoint `/users/:id`.
 * @example The URL `https://movies-app1-3d6bd65a6f09.herokuapp.com/users/649a271eef2156d71e630260` would return the HTML response, "649a271eef2156d71e630260 was deleted." If the user ID does not exist, it will instead return "649a271eef2156d71e630260 was not found."
 */
// Allow existing users to deregister by username —DELETE /users/:id
app.delete(
  "/users/:id",
  passport.authenticate("jwt", { session: false }),
  (req, res) => {
    Users.findOneAndRemove({ _id: req.params.id })
      .then((user) => {
        if (!user) {
          res.status(400).send(req.params.id + " was not found");
        } else {
          res.status(200).send(req.params.id + " was deleted");
        }
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send("Error: " + err);
      });
  }
);

/**
 * get textual default at / route
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/documentation.html"));
});

/**
 * Use express.static to serve your “documentation.html” file from the public folder
 */
app.use(express.static("public"));

/**
 * create error-handling middleware function
 */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Our app is running on port ${PORT}`);
});
