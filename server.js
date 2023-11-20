const express = require('express')
const mysql = require('mysql')
const cors = require('cors')
const crypto = require('crypto')

const app = express()
app.use(cors())
app.use(express.json())

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'metro',
})

function hashPassword(password) {
  const hash = crypto.createHash('sha256')
  hash.update(password)
  return hash.digest('hex')
}

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

app.get('/requests', (req, res) => {
  const sql = `
    SELECT o.requestID, u.first_name, u.last_name, o.status, o.requestDate
    FROM organizerrequest o
    INNER JOIN user u ON o.userID = u.userID
  `
  db.query(sql, (err, data) => {
    if (err) return res.json(err)
    return res.json(data)
  })
})

app.post('/register', (req, res) => {
  const password = typeof req.body.password === 'string' ? req.body.password : req.body.password[0]
  const hashedPassword = hashPassword(password)

  const sql = 'INSERT INTO user(`first_name`,`last_name`,`email`,`password`) VALUES (?, ?, ?, ?)'
  const values = [req.body.firstName, req.body.lastName, req.body.email, hashedPassword]

  db.query(sql, values, (err, data) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ error: 'Error registering user' })
    }
    return res.json({ message: 'User registered successfully' })
  })
})

app.post('/login', (req, res) => {
  const { email, password } = req.body
  const hashedPassword = hashPassword(password)

  const sql = 'SELECT * FROM user WHERE email = ? AND password = ?'
  db.query(sql, [email, hashedPassword], (err, result) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ error: 'Internal Server Error' })
    }

    if (result.length > 0) {
      const data = {
        id: result[0].userID,
        firstName: result[0].first_name,
        lastName: result[0].last_name,
        email: result[0].email,
      }
      return res.json({ success: true, data })
    } else {
      return res.json({ success: false })
    }
  })
})

app.post('/request', (req, res) => {
  const sql = 'INSERT INTO organizerrequest(`userID`) VALUES (?)'
  const values = [req.body.id]

  db.query(sql, values, (err, data) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ success: false, error: 'Error requesting user' })
    }
    return res.json({ success: true, message: 'User succesfully requested' })
  })
})

app.listen(8080, () => {
  console.log('Metro Gala')
})
