import { useLoaderData } from "react-router";
import { api } from "../lib/api";
import CompletedView from "../views/completed.view";

export async function completedLoader() {
    // Get all inbox tasks including completed ones
    const allTasks = await api.listInbox();
    const completedTasks = allTasks.filter(t => t.completed);
    return { tasks: completedTasks };
}

export default function CompletedRoute() {
    const { tasks } = useLoaderData<typeof completedLoader>();
    return <CompletedView tasks={tasks} />;
}
