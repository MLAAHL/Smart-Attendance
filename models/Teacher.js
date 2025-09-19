const mongoose = require('mongoose');

const createdSubjectSchema = new mongoose.Schema({
    subjectId: {
        type: String,
        required: true
    },
    subjectName: {
        type: String,
        required: true
    },
    subjectCode: {
        type: String,
        required: true
    },
    streamId: {
        type: String,
        required: true
    },
    streamName: {
        type: String,
        required: true
    },
    semesterNumber: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'completed'],
        default: 'active'
    },
    studentCount: {
        type: Number,
        default: 0
    },
    students: [{
        uucmsRegNo: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        marks: {
            C1: {
                test1: { type: Number, default: null },
                scaledDown: { type: Number, default: null },
                activity: { type: Number, default: null },
                total: { type: Number, default: null }
            },
            C2: {
                test2: { type: Number, default: null },
                scaledDown: { type: Number, default: null },
                activity: { type: Number, default: null },
                total: { type: Number, default: null }
            },
            grandTotal: { type: Number, default: null }
        }
    }],
    iaTests: [{
        name: String,
        date: Date,
        maxMarks: Number,
        status: {
            type: String,
            enum: ['scheduled', 'ongoing', 'completed'],
            default: 'scheduled'
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

// Completed classes schema for tracking attendance history
const completedClassSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    stream: {
        type: String,
        required: true
    },
    semester: {
        type: Number,
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    timeAdded: String,
    dateAdded: String,
    completedTime: {
        type: String,
        required: true
    },
    completedDate: {
        type: String,
        required: true
    },
    teacherId: String,
    fromCreatedSubject: {
        type: Boolean,
        default: false
    }
}, { _id: false });

// SIMPLE teacher schema - no complex indexes
const teacherSchema = new mongoose.Schema({
    firebaseUid: String, // Simple string field, no constraints
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: String,
    createdSubjects: [createdSubjectSchema],
    completedClasses: [completedClassSchema],
    attendanceQueue: Array,
    lastQueueUpdate: Date
}, {
    timestamps: true
});

// Static methods
teacherSchema.statics.findByFirebaseUid = function(firebaseUid) {
    return this.findOne({ firebaseUid: firebaseUid });
};

teacherSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email });
};

teacherSchema.statics.findByIdentifier = function(firebaseUid, email) {
    if (firebaseUid) {
        return this.findOne({ firebaseUid: firebaseUid });
    } else if (email) {
        return this.findOne({ email: email });
    }
    return null;
};

module.exports = mongoose.model('Teacher', teacherSchema);
