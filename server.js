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

    socket.on('studentJoin', (data) => {
        const { name, active } = data;
        if (name && !students.some(s => s.name === name)) {
            // Save the exact choice text for the roster download
            students.push({ 
                name, 
                active: active === 'yes',
                choiceText: active === 'yes' ? 'Yes (Active)' : 'No (Passive)'
            });
            io.emit('updateStudents', students);
        }
    });

    socket.on('generatePairs', () => {
        let activeStudents = students.filter(s => s.active);
        let passiveStudents = students.filter(s => !s.active);

        const shuffle = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };

        activeStudents = shuffle(activeStudents);
        passiveStudents = shuffle(passiveStudents);

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

        pairs = new Array(36).fill(null);

        let deskIndex = 0;
        activePairs.forEach(pair => {
            if (deskIndex < 36) {
                pairs[deskIndex] = pair;
                deskIndex++;
            }
        });

        let backDeskIndex = 35; 
        passivePairs.reverse().forEach(pair => {
            while (backDeskIndex >= 0 && pairs[backDeskIndex] !== null) {
                backDeskIndex--;
            }
            if (backDeskIndex >= 0) {
                pairs[backDeskIndex] = pair;
            }
        });

        // Send both the pairs and the raw student list with choices back to the dashboard
        io.emit('updatePairs', pairs);
        io.emit('updateStudents', students);
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
