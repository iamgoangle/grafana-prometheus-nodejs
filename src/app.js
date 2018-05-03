const express = require('express');
const Prometheus = require('prom-client');

const app = express();

// matrix
const metricsInterval = Prometheus.collectDefaultMetrics();

// validation matrix
const validationTotal = new Prometheus.Counter({
  name: 'validations_total',
  help: 'Total number of validate',
  labelNames: ['etl_validation']
});

const checkoutsTotal = new Prometheus.Counter({
  name: 'checkouts_total',
  help: 'Total number of checkouts',
  labelNames: ['payment_method']
});
const httpRequestDurationMicroseconds = new Prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500] // buckets for response time from 0.1ms to 500ms
});

// Runs before each requests
app.use((req, res, next) => {
  res.locals.startEpoch = Date.now();
  next();
});

app.get('/', (req, res, next) => {
  setTimeout(() => {
    res.json({ message: 'Hello World!' });
    next();
  }, Math.round(Math.random() * 200));
});

// kaldis submitted
const submitCounter = new Prometheus.Counter({
  name: 'submit_policy',
  help: 'Total submit policy',
  labelNames: ['submit_policy']
});
app.get('/submit', (req, res, next) => {
  submitCounter.inc({
    success: Math.round(Math.random()) === 0 ? false : true
  });

  res.json(submitCounter);

  next();
});

const verifyCounter = new Prometheus.Counter({
  name: 'verify_policy',
  help: 'Total verify policy',
  labelNames: ['verify_policy']
});
app.get('/verify', (req, res, next) => {
  verifyCounter.inc({
    success: Math.round(Math.random()) === 0 ? false : true
  });

  res.json(verifyCounter);

  next();
});

app.get('/bad', (req, res, next) => {
  next(new Error('My Error'));
});

app.get('/validate', (req, res, next) => {
  const validationResult =
    Math.round(Math.random()) === 0 ? 'passed' : 'failed';

  validationTotal.inc({
    etl_validation: validationResult
  });

  res.json({ status: `validate ${validationResult}` });
  next();
});


app.get('/checkout', (req, res, next) => {
  const paymentMethod = Math.round(Math.random()) === 0 ? 'stripe' : 'paypal';

  checkoutsTotal.inc({
    payment_method: paymentMethod
  });

  res.json({ status: 'ok' });
  next();
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', Prometheus.register.contentType);
  res.end(Prometheus.register.metrics());
});

// Error handler
app.use((err, req, res, next) => {
  res.statusCode = 500;
  // Do not expose your error in production
  res.json({ error: err.message });
  next();
});

// Runs after each requests
app.use((req, res, next) => {
  const responseTimeInMs = Date.now() - res.locals.startEpoch;

  httpRequestDurationMicroseconds
    .labels(req.method, req.route.path, res.statusCode)
    .observe(responseTimeInMs);

  next();
});

const server = app.listen('8080', () => {
  console.log(`Example app listening on port 8080!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  clearInterval(metricsInterval);

  server.close(err => {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    process.exit(0);
  });
});
