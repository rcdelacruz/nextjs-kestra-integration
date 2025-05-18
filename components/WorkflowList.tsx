'use client';

export default function WorkflowList({ workflows, activeWorkflowId, onSelect }) {
  if (!workflows || workflows.length === 0) {
    return <p className="text-gray-500">No workflows available</p>;
  }
  
  return (
    <div className="space-y-3">
      {workflows.map((workflow) => (
        <div 
          key={`${workflow.namespace}-${workflow.id}`}
          className={`workflow-card cursor-pointer ${
            activeWorkflowId === workflow.id ? 'border-kestra-blue bg-blue-50' : ''
          }`}
          onClick={() => onSelect(workflow.id)}
        >
          <h3 className="font-medium text-lg">{workflow.id}</h3>
          <p className="text-sm text-gray-600 truncate">{workflow.namespace}</p>
          {workflow.description && (
            <p className="mt-2 text-sm text-gray-700">{workflow.description}</p>
          )}
          <div className="mt-2 flex items-center">
            {workflow.hasWebhookTrigger ? (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                Webhook Ready
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                No Webhook
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}