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

const teacherSchema = new mongoose.Schema({
    // MongoDB ObjectId (auto-generated)
    _id: {
        type: mongoose.Schema.Types.ObjectId,
        auto: true
    },
    
    // Firebase UID (separate field)
    firebaseUid: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: false,
        default: ''
    },
    createdSubjects: [createdSubjectSchema],
    
    // Attendance queue management
    attendanceQueue: {
        type: Array,
        default: []
    },
    completedToday: {
        type: Array,
        default: []
    },
    lastQueueUpdate: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Add validation for Firebase UID
teacherSchema.pre('save', function(next) {
    if (!this.firebaseUid || this.firebaseUid === null || this.firebaseUid === '') {
        return next(new Error('Firebase UID is required and cannot be null'));
    }
    next();
});

// Static method to find by Firebase UID
teacherSchema.statics.findByFirebaseUid = function(firebaseUid) {
    return this.findOne({ firebaseUid: firebaseUid });
};

module.exports = mongoose.model('Teacher', teacherSchema);