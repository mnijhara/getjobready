// Canonical production entrypoint.
import { installTelemetry } from './telemetry.js';
import './auth-gateway.js';
import '../interview-context-bridge.js';
import './main-v2.jsx';

installTelemetry();
