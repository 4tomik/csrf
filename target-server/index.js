const express = require('express');
const session = require('express-session');
const flash = require('connect-flash-plus');
const handlebars = require('express-handlebars');
const { v4: uuid } = require('uuid');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middlwares

// app.use(cors({
//   origin: 'http://localhost:5000',
//   credentials: true,
// }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'test',
  resave: false,
  saveUninitialized: false,
}));
app.use(flash());
app.set("views", __dirname);
app.engine("hbs", handlebars({
  defaultLayout: 'main',
  layoutsDir: __dirname,
  extname: '.hbs',
}));
app.set("view engine", "hbs");

// Login

const login = (req, res, next) => {
  if (!req.session.userId) {
    res.redirect('/login');
  } else {
    next();
  }
}

// CSRF

const tokens = new Map();

const csrfToken = (sessionId) => {
  const token = uuid();
  const userTokens = tokens.get(sessionId);
  userTokens.add(token);
  setTimeout(() => userTokens.delete(token), 30000);

  return token;
}

const csrf = (req, res, next) => {
  const token = req.body.csrf;
  if (!token || !tokens.get(req.sessionID).has(token)) {
    res.status(422).send('CSRF Token missing or expired');
  } else {
    next();
  }
}

// Db

const users = JSON.parse(fs.readFileSync('db.json'));

// Routes

app.get('/home', login, (req, res) => {
  res.send('Home page, must be logged in to access');
});

app.get('/login', (req, res) => {
  console.log(req.session);
  res.render('login', { message: req.flash('message') });
});

app.post('/login', (req, res) => {
  if (!req.body.email || !req.body.password) {
    req.flash('message', 'Fill all the fields');
    return res.redirect('/login');
  }
  const user = users.find(user => user.email === req.body.email);
  if (!user || user.password !== req.body.password) {
    req.flash('message', 'Invalid credentials');
    return res.redirect('/login');
  }
  req.session.userId = user.id;
  tokens.set(req.sessionID, new Set());
  console.log(req.session);
  res.redirect('/home');
});

app.get('/logout', login, (req, res) => {
  req.session.destroy();
  res.send('Logged out');
})

app.get('/edit', login, (req, res) => {
  res.render('edit', { token: csrfToken(req.sessionID) });
});

app.post('/edit', login, csrf, (req, res) => {
  const user = users.find(user => user.id === req.session.userId);
  user.email = req.body.email;
  console.log(`User ${user.id} email changed to ${user.email}`);
  // fs.writeFileSync('db.json', JSON.stringify(users));

  res.send(`Email changed to ${user.email}`);
});

// Server

app.listen(PORT, () => console.log('Listening on port', PORT));
