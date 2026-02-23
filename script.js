const express=require("express")
const app=express()
const session=require("express-session")
const userrouter=require("./route/user")
const adminrouter=require("./route/admin")
const connectdb=require("./config/db,js")
const dotenv=require("dotenv").config()
const passport = require("./config/passport");
const methodOverride = require('method-override');

app.use(require("express-session")({
  secret: "secretkey",
  resave: false,
  saveUninitialized: false
}));




app.use(passport.initialize());
app.use(passport.session());
app.use(express.static("public"));


app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

app.use(express.urlencoded({extended:true}))
app.use(methodOverride('_method'));
app.use(express.json())

app.use(
  session({
    secret: "otp-secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.set("view engine","ejs")
app.set("views","./views")




app.use("/",userrouter)
app.use("/admin",adminrouter)

connectdb()
app.listen("9000",()=>{
    console.log("serverready")
})