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

// GET METHODS
app.get('/joined-events/:user_id', (req, res) => {
  const userId = req.params.user_id

  const joinedEventsSql = `
    SELECT e.eventID AS id, e.eventName, e.eventDate, e.eventLocation, e.eventStatus
    FROM event e
    INNER JOIN participants p ON e.eventID = p.event_id
    WHERE p.user_id = ?
    ORDER BY e.eventDate DESC;
  `

  db.query(joinedEventsSql, userId, (err, result) => {
    if (err) {
      console.error('Error fetching joined events:', err)
      return res.status(500).json({ error: 'Error fetching joined events' })
    }

    return res.json(result)
  })
})

app.get('/your-events/:organizerID', (req, res) => {
  const { organizerID } = req.params

  const sql = `
    SELECT e.eventID as id, e.eventName, e.organizerID, e.eventStatus, e.eventDescription, 
           e.eventDate, e.eventLocation, e.eventType, e.image,
           COUNT(p.user_id) AS participantCount
    FROM event e
    LEFT JOIN participants p ON e.eventID = p.event_id
    WHERE e.organizerID = ?
    GROUP BY e.eventID
    ORDER BY e.eventDate ASC`

  db.query(sql, [organizerID], (err, data) => {
    if (err) return res.json(err)
    return res.json(data)
  })
})

app.get('/users', (req, res) => {
  const sql = 'SELECT * FROM user ORDER BY userID DESC'

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
    ORDER BY o.requestDate DESC
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

app.get('/profile/:user_id', (req, res) => {
  const userId = req.params.user_id
  const sql = 'SELECT * FROM user WHERE userID = ?'
  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ error: 'Error fetching user data' })
    }

    if (result.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }
    const userProfile = result[0]
    return res.json({ user: userProfile })
  })
})

//POST METHODS

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
        type: result[0].user_type,
        profile_pic: result[0].profile_pic,
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

  console.log(userID)

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

app.post('/join-event', (req, res) => {
  const { user_id, first_name, last_name, gender, age, email, address, event_id, upvote } = req.body

  const checkParticipantSql = 'SELECT * FROM participants WHERE user_id = ? AND event_id = ?'
  const checkParticipantValues = [user_id, event_id]

  db.query(
    checkParticipantSql,
    checkParticipantValues,
    (checkParticipantErr, checkParticipantResult) => {
      if (checkParticipantErr) {
        console.error('Error checking participant:', checkParticipantErr)
        return res.status(500).json({ error: 'Error joining the event' })
      }

      if (checkParticipantResult.length > 0) {
        return res.json({ message: 'User has already joined this event' })
      }

      const participantSql =
        'INSERT INTO participants (user_id, first_name, last_name, address, age, gender, email, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      const participantValues = [
        user_id,
        first_name,
        last_name,
        address,
        age,
        gender,
        email,
        event_id,
      ]

      db.query(participantSql, participantValues, (participantErr, participantResult) => {
        if (participantErr) {
          console.error('Error inserting participant:', participantErr)
          return res.status(500).json({ error: 'Error joining the event' })
        }

        // Participant inserted successfully, now update upvote in the event table
        const updateEventSql = 'UPDATE event SET upvote = upvote + 1 WHERE eventID = ?'
        const updateEventValues = [event_id]

        db.query(updateEventSql, updateEventValues, (updateEventErr, updateEventResult) => {
          if (updateEventErr) {
            console.error('Error updating event upvote:', updateEventErr)
            return res.status(500).json({ error: 'Error joining the event' })
          }

          return res.json({ message: 'Participant joined the event successfully' })
        })
      })
    },
  )
})

// app.post('/join-event', (req, res) => {
//   const { user_id, first_name, last_name, gender, age, email, address, event_id, upvote } = req.body

//   const checkParticipantSql = 'SELECT * FROM participants WHERE user_id = ? AND event_id = ?'
//   const checkParticipantValues = [user_id, event_id]

//   db.query(
//     checkParticipantSql,
//     checkParticipantValues,
//     (checkParticipantErr, checkParticipantResult) => {
//       if (checkParticipantErr) {
//         console.error('Error checking participant:', checkParticipantErr)
//         return res.status(500).json({ error: 'Error joining the event' })
//       }

//       if (checkParticipantResult.length > 0) {
//         return res.json({ message: 'User has already joined this event' })
//       }
//       const participantSql =
//         'INSERT INTO participants (user_id, first_name, last_name, address, age, gender, email, event_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
//       const participantValues = [
//         user_id,
//         first_name,
//         last_name,
//         address,
//         age,
//         gender,
//         email,
//         event_id,
//       ]

//       db.query(participantSql, participantValues, (participantErr, participantResult) => {
//         if (participantErr) {
//           console.error('Error inserting participant:', participantErr)
//           return res.status(500).json({ error: 'Error joining the event' })
//         }
//         return res.json({ message: 'Participant joined the event successfully' })
//       })
//     },
//   )
// })

app.post('/delete-event', (req, res) => {
  const { eventID } = req.body

  const sql = 'DELETE FROM event WHERE eventID = ?'
  db.query(sql, [eventID], (err, result) => {
    if (err) {
      res.status(500).json({ message: 'An error occurred while deleting the event.' })
      throw err
    }
    res.status(200).json({ message: 'Event deleted successfully.' })
  })
})

app.post('/edit-profile', upload.single('profilePic'), (req, res) => {
  const { userID, firstName, lastName, email, password } = req.body
  const profilePic = req.file ? req.file.filename : null
  const hashedPassword = hashPassword(password)

  const sql =
    'UPDATE user SET first_name=?, last_name=?, email=?, password=?, profile_pic=? WHERE userID=?'
  const values = [
    firstName || null,
    lastName || null,
    email || null,
    hashedPassword || null,
    profilePic || null,
    userID,
  ]

  db.query(sql, values, (err, data) => {
    if (err) {
      console.error(err)
      return res.status(500).json({ error: 'Error updating user data' })
    }
    return res.json({ message: 'User data updated successfully' })
  })
})

app.listen(8080, () => {
  console.log('Metro Gala')
})
