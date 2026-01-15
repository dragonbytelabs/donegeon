/* @refresh reload */
import { render } from "solid-js/web";
import "./app.css";
import { Route, Router } from "@solidjs/router";
import DashboardRoute from "./routes/Dashboard";
import BoardRoute from "./routes/Board";
import TasksRoute from "./routes/Tasks";

render(
  () => (
    <Router>
      <Route path="/" component={DashboardRoute} />
      <Route path="/board" component={BoardRoute} />
      <Route path="/tasks" component={TasksRoute} />
    </Router>
  ),
  document.getElementById("root")!
);

