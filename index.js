require('dotenv').config()

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.ladfrnr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const jobsCollection = client.db('jobPortal').collection('jobs');
        const jobApplicationCollection = client.db('jobPortal').collection('job_application');

        // Auth Related Apis
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' });
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: false,
                })
                .send({ success: true });
        })

        // jobs apis
        app.get('/jobs', async (req, res) => {

            const email = req.query.email;
            let query = {};
            if (email) {
                query = { hr_email: email }
            }

            const cursor = jobsCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });
        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobsCollection.findOne(query);
            res.send(result);
        })
        // job applications apis
        app.post('/jobs', async (req, res) => {
            const data = req.body;
            const result = await jobsCollection.insertOne(data);
            res.send(result);
        })
        app.post('/job-application', async (req, res) => {
            const application = req.body;
            const result = await jobApplicationCollection.insertOne(application);

            // not the best way {use aggregate}
            const id = application.job_id;
            const query = { _id: new ObjectId(id) }
            const job = await jobsCollection.findOne(query);
            let newCount = 0;
            if (job.applicationCount) {
                newCount = job.applicationCount + 1;
            }
            else {
                newCount = 1;
            }

            // filter now
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    applicationCount: newCount
                }
            }

            const updatedResult = await jobsCollection.updateOne(filter, updatedDoc)

            res.send(result);
        })
        app.get('/job-application', async (req, res) => {
            const email = req.query.email;
            const query = { applicant_email: email };
            const result = await jobApplicationCollection.find(query).toArray();

            // fokira way
            for (const application of result) {
                console.log(application.jobs_id);
                const query1 = { _id: new ObjectId(application.job_id) }
                const job = await jobsCollection.findOne(query1);
                if (job) {
                    application.title = job.title;
                    application.location = job.location;
                    application.company = job.company;
                    application.company_logo = job.company_logo;
                    application.category = job.category;
                }
            }

            res.send(result);
        })
        app.delete('/job-application/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobApplicationCollection.deleteOne(query);
            res.send(result);
        })
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Job is falling form the sky ');
})

app.listen(port, () => {
    console.log(`job is running on port${port}`);
})