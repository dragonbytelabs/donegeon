package task

import (
	"fmt"
	"strings"
	"time"

	"donegeon/internal/model"
)

const icsDateLayout = "20060102"

// BuildTaskCalendarICS builds a simple iCalendar event for a task.
// A due date is required so the exported event has a concrete start date.
func BuildTaskCalendarICS(t model.Task, now time.Time) (string, error) {
	dueRaw := ""
	if t.DueDate != nil {
		dueRaw = strings.TrimSpace(*t.DueDate)
	}
	if dueRaw == "" {
		return "", fmt.Errorf("task due date required for calendar export")
	}

	due, err := time.ParseInLocation("2006-01-02", dueRaw, time.Local)
	if err != nil {
		return "", fmt.Errorf("task due date must be YYYY-MM-DD")
	}
	end := due.AddDate(0, 0, 1)

	title := strings.TrimSpace(t.Title)
	if title == "" {
		title = "Donegeon Task"
	}
	desc := strings.TrimSpace(t.Description)

	uid := fmt.Sprintf("task-%s@donegeon", strings.TrimSpace(string(t.ID)))
	if strings.TrimSpace(string(t.ID)) == "" {
		uid = fmt.Sprintf("task-export-%d@donegeon", now.UnixNano())
	}

	lines := []string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Donegeon//Task Export//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"BEGIN:VEVENT",
		"UID:" + escapeICSText(uid),
		"DTSTAMP:" + now.UTC().Format("20060102T150405Z"),
		"SUMMARY:" + escapeICSText(title),
		"DTSTART;VALUE=DATE:" + due.Format(icsDateLayout),
		"DTEND;VALUE=DATE:" + end.Format(icsDateLayout),
	}
	if desc != "" {
		lines = append(lines, "DESCRIPTION:"+escapeICSText(desc))
	}
	if rrule := recurrenceToICSRRULE(t.Recurrence); rrule != "" {
		lines = append(lines, "RRULE:"+rrule)
	}
	lines = append(lines, "END:VEVENT", "END:VCALENDAR", "")

	return strings.Join(lines, "\r\n"), nil
}

func recurrenceToICSRRULE(rec *model.Recurrence) string {
	if rec == nil {
		return ""
	}
	interval := rec.Interval
	if interval <= 0 {
		interval = 1
	}

	freq := ""
	switch strings.ToUpper(strings.TrimSpace(rec.Type)) {
	case "DAILY":
		freq = "DAILY"
	case "WEEKLY":
		freq = "WEEKLY"
	case "MONTHLY":
		freq = "MONTHLY"
	default:
		return ""
	}

	return fmt.Sprintf("FREQ=%s;INTERVAL=%d", freq, interval)
}

func escapeICSText(s string) string {
	repl := strings.NewReplacer(
		"\\", "\\\\",
		";", "\\;",
		",", "\\,",
		"\r\n", "\\n",
		"\n", "\\n",
		"\r", "\\n",
	)
	return repl.Replace(s)
}
