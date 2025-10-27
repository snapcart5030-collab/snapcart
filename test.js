const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://ganesh:ganeshsnap@cluster0.1xnz3b5.mongodb.net/snapcart?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('MongoDB connected successfully!');
})
.catch((err) => {
    console.error('MongoDB connection error:', err);
});
