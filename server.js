const express = require('express')
const mysql = require('mysql')
const cors = require('cors')
const crypto = require('crypto')
const multer = require('multer')
const path = require('path')

const storage = multer.diskStorage({
  destination: 'public/image/uploads/',
  filename: (req, file, cb) => {
    return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
  },
})

const upload = multer({ storage: storage })

const app = express()
app.use(cors())
app.use(express.json())
app.use('/images', express.static(path.join(__dirname, 'public/image/uploads')))

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
    SELECT o.requestID, u.first_name, u.last_name, o.status, o.requestDate, o.userID
    FROM organizerrequest o
    INNER JOIN user u ON o.userID = u.userID
  `
  db.query(sql, (err, data) => {
    if (err) return res.json(err)
    return res.json(data)
  })
})

app.get('/events', (req, res) => {
  const sql = 'SELECT * from event'
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
  const userID = req.body.userID
  const checkRequestSql = 'SELECT COUNT(*) AS count FROM organizerrequest WHERE userID = ?'
  const checkRequestValues = [userID]

  db.query(checkRequestSql, checkRequestValues, (err, result) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ success: false, error: 'Error checking user request' })
    }

    const userRequestExists = result[0].count > 0

    if (userRequestExists) {
      return res.json({ success: false, message: 'User has already made a request' })
    } else {
      const organizerSql = 'INSERT INTO organizerrequest(`userID`) VALUES (?)'
      const organizerValues = [userID]

      db.query(organizerSql, organizerValues, (err, data) => {
        if (err) {
          console.error(err)
          return res.status(500).json({ success: false, error: 'Error requesting user' })
        }
        return res.json({ success: true, message: 'User successfully requested' })
      })
    }
  })
})

app.post('/request/action', (req, res) => {
  const action = req.body.action
  const requestId = req.body.requestID
  const userID = req.body.userID
  let sql, message

  switch (action) {
    case 'Approve':
      sql =
        'UPDATE `organizerrequest` SET `status` = "Approved", `dateReviewed` = NOW() WHERE `organizerrequest`.`requestID` = ?'
      message = 'User request approved'
      break
    case 'Decline':
      sql =
        'UPDATE `organizerrequest` SET `status` = "Declined", `dateReviewed` = NOW() WHERE `organizerrequest`.`requestID` = ?'
      message = 'User request declined'
      break
    default:
      return res.status(400).json({ success: false, error: 'Invalid action' })
  }
  const values = [requestId]

  db.query(sql, values, (err, data) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ success: false, error: `Error ${action}ing user request` })
    }

    if (action === 'Approve') {
      const updateSql = 'UPDATE `user` SET `user_type` = "organizer" WHERE `user`.`userID` = ?'
      db.query(updateSql, userID, (updateErr, updateData) => {
        if (updateErr) {
          console.error(updateErr)
          return res.status(500).json({ success: false, error: `Error ${action}ing user request` })
        }
        return res.json({ success: true, message })
      })
    } else {
      return res.json({ success: true, message })
    }
  })
})

app.post('/create-events', upload.single('image'), (req, res) => {
  const { event, location, organizer, description, date, type } = req.body

  // Format the date to MySQL format (YYYY-MM-DD HH:MM:SS)
  const formattedDate = new Date(date).toISOString().slice(0, 19).replace('T', ' ')
  console.log(formattedDate)
  const image = req.file.filename

  const sql =
    'INSERT INTO event (eventName, eventLocation, organizerID, eventDescription, eventDate, eventType, image) VALUES (?, ?, ?, ?, ?, ?, ?)'
  const values = [event, location, organizer, description, formattedDate, type, image]

  db.query(sql, values, (err, data) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ error: 'Error inserting event data' })
    }
    return res.json({ message: 'Event data inserted successfully' })
  })
})

app.listen(8080, () => {
  console.log('Metro Gala')
})
