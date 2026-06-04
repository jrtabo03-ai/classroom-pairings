const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

let students = [];
let pairs = [];

app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.emit('updateStudents', students);
    socket.emit('updatePairs', pairs);

    // Receive name and participation preference
    socket.on('studentJoin', (data) => {
        const { name, active } = data;
        // Prevent duplicate names
        if (name && !students.some(s => s.name === name)) {
            students.push({ name, active: active === 'yes' });
            io.emit('updateStudents', students);
        }
    });

    socket.on('generatePairs', () => {
        // 1. Separate students based on participation
        let activeStudents = students.filter(s => s.active);
        let passiveStudents = students.filter(s => !s.active);

        // Helper function to shuffle an array
        const shuffle = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };

        // 2. Shuffle both groups independently
        activeStudents = shuffle(activeStudents);
        passiveStudents = shuffle(passiveStudents);

        // Helper function to turn a list of students into pairs
        const chunkIntoPairs = (studentList, labelSuffix = "") => {
            let chunked = [];
            for (let i = 0; i < studentList.length; i += 2) {
                if (studentList[i + 1]) {
                    chunked.push([studentList[i].name, studentList[i + 1].name]);
                } else {
                    chunked.push([studentList[i].name, `Lone Wolf 🐺 ${labelSuffix}`]);
                }
            }
            return chunked;
        };

        const activePairs = chunkIntoPairs(activeStudents);
        const passivePairs = chunkIntoPairs(passiveStudents, "(Passive)");

        // 3. Arrange seating array: Active pairs first, Passive pairs at the very end
        // Total desks = 3 columns * 12 rows = 36 desks
        pairs = new Array(36).fill(null);

        // Place active pairs starting from Desk 1 (Front)
        let deskIndex = 0;
        activePairs.forEach(pair => {
            if (deskIndex < 36) {
                pairs[deskIndex] = pair;
                deskIndex++;
            }
        });

        // Place passive pairs starting from the very last desk, moving backward
        let backDeskIndex = 35; 
        passivePairs.reverse().forEach(pair => {
            // Find the next available empty desk from the back
            while (backDeskIndex >= 0 && pairs[backDeskIndex] !== null) {
                backDeskIndex--;
            }
            if (backDeskIndex >= 0) {
                pairs[backDeskIndex] = pair;
            }
        });

        io.emit('updatePairs', pairs);
    });

    socket.on('resetClass', () => {
        students = [];
        pairs = [];
        io.emit('updateStudents', students);
        io.emit('updatePairs', pairs);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});