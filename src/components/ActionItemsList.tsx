import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, User, Flag, Download, CheckCircle2, Circle } from "lucide-react";
import { ActionItem } from "@/lib/actionItems";

interface ActionItemsListProps {
  actionItems: ActionItem[];
  onStatusChange?: (id: string, status: ActionItem['status']) => void;
  onExport?: () => void;
}

const ActionItemsList = ({ actionItems, onStatusChange, onExport }: ActionItemsListProps) => {
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'low':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleStatusToggle = (id: string, currentStatus: ActionItem['status']) => {
    if (!onStatusChange) return;
    
    const nextStatus: ActionItem['status'] = 
      currentStatus === 'completed' 
        ? 'pending' 
        : currentStatus === 'pending'
        ? 'in-progress'
        : 'completed';
    
    onStatusChange(id, nextStatus);
  };

  const handleExportICal = () => {
    const icalContent = actionItems
      .filter(item => item.status !== 'completed' && item.deadline)
      .map(item => {
        const now = new Date();
        const deadlineDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Default to 7 days if no specific date
        
        return `BEGIN:VEVENT
UID:${item.id}@sonic-note-maker
DTSTAMP:${now.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${deadlineDate.toISOString().replace(/[-:]/g, '').split('.')[0]}Z
SUMMARY:${item.description}
DESCRIPTION:Action Item: ${item.description}${item.assignee ? `\\nAssignee: ${item.assignee}` : ''}${item.priority ? `\\nPriority: ${item.priority}` : ''}
STATUS:CONFIRMED
END:VEVENT`;
      })
      .join('\n');

    const fullIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Sonic Note Maker//Action Items//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${icalContent}
END:VCALENDAR`;

    const blob = new Blob([fullIcal], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'action-items.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportText = () => {
    const text = actionItems
      .map((item, index) => {
        const statusIcon = item.status === 'completed' ? '✓' : item.status === 'in-progress' ? '→' : '○';
        return `${index + 1}. ${statusIcon} ${item.description}
   ${item.assignee ? `   Assignee: ${item.assignee}` : ''}
   ${item.deadline ? `   Deadline: ${item.deadline}` : ''}
   ${item.priority ? `   Priority: ${item.priority}` : ''}
`;
      })
      .join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'action-items.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (actionItems.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        No action items found in this transcript.
      </Card>
    );
  }

  const pendingCount = actionItems.filter(item => item.status === 'pending').length;
  const inProgressCount = actionItems.filter(item => item.status === 'in-progress').length;
  const completedCount = actionItems.filter(item => item.status === 'completed').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-4 text-sm">
          <span className="text-muted-foreground">
            Total: <strong>{actionItems.length}</strong>
          </span>
          <span className="text-muted-foreground">
            Pending: <strong>{pendingCount}</strong>
          </span>
          <span className="text-muted-foreground">
            In Progress: <strong>{inProgressCount}</strong>
          </span>
          <span className="text-muted-foreground">
            Completed: <strong>{completedCount}</strong>
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportICal}
            disabled={actionItems.filter(item => item.status !== 'completed' && item.deadline).length === 0}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Export iCal
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportText}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Text
          </Button>
        </div>
      </div>

      {/* Action Items */}
      <div className="space-y-3">
        {actionItems.map((item) => (
          <Card
            key={item.id}
            className={`p-4 transition-colors ${
              item.status === 'completed' ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              {onStatusChange ? (
                <button
                  onClick={() => handleStatusToggle(item.id, item.status)}
                  className="mt-1 flex-shrink-0"
                  aria-label={`Toggle status for ${item.description}`}
                >
                  {item.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : item.status === 'in-progress' ? (
                    <Circle className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
              ) : (
                <div className="mt-1 flex-shrink-0">
                  {item.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : item.status === 'in-progress' ? (
                    <Circle className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <p className={`text-base leading-relaxed ${
                  item.status === 'completed' ? 'line-through text-muted-foreground' : ''
                }`}>
                  {item.description}
                </p>
                
                <div className="flex flex-wrap gap-3 mt-3">
                  {item.assignee && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span>{item.assignee}</span>
                    </div>
                  )}
                  {item.deadline && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{item.deadline}</span>
                    </div>
                  )}
                  {item.priority && (
                    <Badge variant="outline" className={getPriorityColor(item.priority)}>
                      <Flag className="w-3 h-3 mr-1" />
                      {item.priority}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="ml-auto">
                    {item.status}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ActionItemsList;

