import { Hono } from "hono";
import talksRoute from "./routes/talks";
import top from "./routes/top";
import works from "./routes/works";

const app = new Hono();

app.route("/", top);
app.route("/works", works);
app.route("/talks", talksRoute);

export default app;
