$TaskerDb = Join-Path $env:APPDATA 'com.tasker.focus\tasker.db'
function Get-TaskerDb { $TaskerDb }
function Invoke-TaskerSql {
    param([Parameter(Mandatory = $true)][string]$Query)
    & sqlite3 $TaskerDb $Query
}
function Get-TaskerTasks {
    $sql = "SELECT json_group_array(json_object('id', id, 'title', title, 'status', status, 'projectId', project_id, 'estimateMin', estimate_min, 'dueDate', due_date, 'scheduledDate', scheduled_date)) FROM (SELECT id, json_extract(data, '$.title') AS title, json_extract(data, '$.status') AS status, json_extract(data, '$.projectId') AS project_id, json_extract(data, '$.estimateMin') AS estimate_min, json_extract(data, '$.dueDate') AS due_date, json_extract(data, '$.scheduledDate') AS scheduled_date FROM tasks ORDER BY position);"
    Invoke-TaskerSql $sql
}
function Get-TaskerProjects {
    $sql = "SELECT json_group_array(json_object('id', id, 'name', name)) FROM (SELECT id, json_extract(data, '$.name') AS name FROM projects ORDER BY position);"
    Invoke-TaskerSql $sql
}
function New-TaskerTask {
    param([Parameter(Mandatory = $true)][string]$Title, [string]$ProjectId, [int]$EstimateMin = 25)
    $id = "task-" + [Guid]::NewGuid().ToString("N").Substring(0, 12)
    $now = (Get-Date).ToUniversalTime().ToString("o")
    $project = if ($ProjectId) { "'$ProjectId'" } else { "NULL" }
    $sql = "INSERT INTO tasks (id, project_id, status, scheduled_date, scheduled_time, position, data) VALUES ('$id', $project, 'inbox', NULL, NULL, (SELECT COALESCE(MAX(position), 0) + 1 FROM tasks), json('{""id"":""$id"",""title"":""$Title"",""description"":"""",""projectId"":$project,""status"":""inbox"",""priority"":""normal"",""estimateMin"":$EstimateMin,""dueDate"":null,""scheduledDate"":null,""scheduledTime"":null,""criteria"":[],""notes"":"""",""createdAt"":""$now"",""updatedAt"":""$now"",""completedAt"":null,""focusedMinutes"":0}'));"
    Invoke-TaskerSql $sql
    Write-Host "Created task $id"
}
function Remove-TaskerTask {
    param([Parameter(Mandatory = $true)][string]$Id)
    Invoke-TaskerSql "DELETE FROM tasks WHERE id = '$Id';"
    Write-Host "Removed task $Id"
}
function Remove-TaskerProject {
    param([Parameter(Mandatory = $true)][string]$Id)
    Invoke-TaskerSql "DELETE FROM projects WHERE id = '$Id';"
    Write-Host "Removed project $Id"
}
Write-Host "Tasker shell loaded. Database: $TaskerDb"
