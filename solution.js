import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import env from "dotenv";

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

app.set('view engine', 'ejs');
app.use(
  session({
    secret: "TOPSECRETWORD",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "secrets",
  password: "123456",
  port: 5432,
});
db.connect();

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/mycomments", async(req,res) =>{
  if(req.isAuthenticated()){
    const User = req.user.email; 
    const comment = await db.query("SELECT * FROM comment WHERE username = $1", [User])
    res.render("mycomments.ejs", {comments: comment.rows});
  }else{
    res.render("login.ejs");
  }
});

app.get("/comment", async(req,res)=>{
  if(req.isAuthenticated()){ 
    res.render("comment.ejs");
  } else {
    res.render("login.ejs");
  }
});

app.get("/secrets", async (req, res) => {
  try {
    const User = req.user.email;
    const blogs = await db.query("SELECT * FROM blog");
    res.render("secrets", { blogs: blogs.rows , user: User });
  } catch (err) {
    console.error("Error fetching blogs:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/newBlog", (req, res) => {
  if(req.isAuthenticated()){
    res.render("newBlog.ejs");
  } else {
    res.redirect("/login");
  }
});

app.get("/myBlog", async(req,res)=>{
  if(req.isAuthenticated()){
    const user = req.user.email;
    const blogs = await db.query("SELECT * FROM blog WHERE username = $1", [user]);
    res.render("myBlog.ejs", { blogs: blogs.rows });
  } else {
    res.render("login.ejs");
  }
});

app.get("/commentsection", async(req,res) =>{
  const heading = req.query.toCommentSection;
  const comment = await db.query("SELECT * FROM comment WHERE heading = $1", [heading]);
  res.render("commentsection.ejs",{comments: comment.rows, heading: heading});
});

app.post("/comment", async(req,res)=>{
  const User = req.user.email;
  const heading = req.body.commentToBesavedfor;
  const comment  = req.body.comment;
  await db.query("insert into comment (username, heading, coment) VALUES($1, $2, $3)", [User, heading, comment]);
  res.redirect("/secrets");
});

app.post("/newBlog", async(req, res)=>{
  const User = req.user.email;
  const heading = req.body.heading;
  const blog = req.body.blog;
  await db.query("INSERT INTO blog (username, heading , blog ) VALUES($1, $2, $3)", [User, heading , blog]);
  res.redirect("/secrets");
});

app.post("/delete" , async(req, res) =>{
  const item = req.body.headingtd;
  await db.query("DELETE FROM blog WHERE heading = $1", [item]);
  res.redirect("/myBlog");
});

app.post("/deletecomment" , async(req, res) =>{
  const item = req.body.commenttd;
  const heading = req.body.commenthead;
  await db.query("DELETE FROM comment WHERE coment = $1 AND heading = $2", [item,heading]);
  res.redirect("/mycomments");
});

app.post("/edit", async (req, res) => {
  const originalHeading = req.body.notupdatedItemheading;
  const updatedItemheading= req.body.updatedItemheading;
  try {
    await db.query("UPDATE blog SET heading = ($1) WHERE heading = ($2)", [updatedItemheading, originalHeading]);
    res.redirect("/myBlog");
  } catch (err) {
    console.log(err);
  }
});

app.post("/editblog", async (req, res) => {
  const originalHeadingg = req.body.notupdatedItemblogg;
  const updatedItemheadingg= req.body.updatedItemblogg;
  try {
    await db.query("UPDATE blog SET blog = ($1) WHERE blog = ($2)", [updatedItemheadingg, originalHeadingg]);
    res.redirect("/myBlog");
  } catch (err) {
    console.log(err);
  }
});

app.post("/login", passport.authenticate("local", {
  successRedirect: "/secrets",
  failureRedirect: "/login",
}));

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;
  const dob = req.body.dob;
  const age = req.body.age;
  const gender = req.body.gender;
  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

    if (checkResult.rows.length > 0) {
      req.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password, dob, age, gender) VALUES ($1, $2, $3, $4, $5) RETURNING *",
            [email, hash, dob, age, gender]
          );
          const user = result.rows[0];
          req.login(user, (err) => {
            console.log("success");
            res.redirect("/secrets");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

passport.use(
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [username]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.post("/delete" , async (req, res) =>{
  const email = req.user.email;
  const age = req.body.age;
  await db.query("UPDATE users SET age = null WHERE email  = $1 ", [email]);
  console.log("delete");
  res.redirect("/secrets")
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
