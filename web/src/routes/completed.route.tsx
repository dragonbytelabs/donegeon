import { useLoaderData } from "react-router";
import { api } from "../lib/api";
import CompletedView from "../views/completed.view";

export async function completedLoader() {
    // Get tasks from completed zone
    const completedTasks = await api.listCompleted();
    return { tasks: completedTasks };
}

export default function CompletedRoute() {
    const { tasks } = useLoaderData<typeof completedLoader>();
    return <CompletedView tasks={tasks} />;
}
