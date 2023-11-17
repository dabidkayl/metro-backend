const express = require('express')
const mysql = require('mysql')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'metro',
})

app.get('/', (req, res) => {
  return res.json('From backend Side')
})

app.get('/users', (req, res) => {
  const sql = 'SELECT * from user'
  db.query(sql, (err, data) => {
    if (err) return res.json(err)
    return res.json(data)
  })
})

app.post('/register', (req, res) => {
  const sql = 'INSERT INTO user(`email`,`password`) VALUE (?)'
  const values = [req.body.email, req.body.password]
  db.query(sql, [values], (err, data) => {
    if (err) return res.json(err)
    return res.json(data)
  })
})

app.post('/login', (req, res) => {
  const sql = 'SELECT * FROM user WHERE `email` = ? AND `password` = ?'
  const email = req.body.email
  const pass = req.body.password
  db.query(sql, [email, pass], (err, data) => {
    if (err) return res.json(err)
    if (data.length > 0) {
      return res.json('Success')
    } else {
      return res.json('Failed')
    }
  })
})

app.listen(8080, () => {
  console.log('Metro Gala')
})
