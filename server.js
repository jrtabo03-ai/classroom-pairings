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
            students.push({ 
                name, 
                active: active === 'yes',
                choiceText: active === 'yes' ? 'Yes (Active)' : 'No (Passive)'
            });
            io.emit('updateStudents', students);
        }
    });

    // Handle Manual Seating Overrides from Teacher Dashboard
    socket.on('manualSeatEdit', (data) => {
        const { deskIndex, name1, name2 } = data;
        
        // Initialize pairs array if empty
        if (pairs.length === 0) {
            pairs = new Array(36).fill(null);
        }

        // 1. Update the seating desk arrangement memory
        if (!name1 && !name2) {
            pairs[deskIndex] = null; // Desk cleared completely
        } else {
            pairs[deskIndex] = [name1 || "Empty", name2 || "Empty"];
        }

        // 2. Add any newly entered manual names to the master student list for CSV downloads
        [name1, name2].forEach(name => {
            if (name && name !== "Empty" && !name.includes("Lone Wolf") && !students.some(s => s.name === name)) {
                students.push({
                    name: name,
                    active: true,
                    choiceText: 'Manual Add (Active)'
                });
            }
        });

        // 3. Broadcast real-time changes out to both Dashboard and Seating charts
        io.emit('updatePairs', pairs);
        io.emit('updateStudents', students);
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
