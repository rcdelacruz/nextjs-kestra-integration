import WorkflowDashboard from '@/components/WorkflowDashboard';

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold mb-4">Kestra Workflow Integration</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Manage and monitor your Kestra workflows in real-time using Next.js Server-Sent Events.
        </p>
      </div>
      
      <WorkflowDashboard />
    </div>
  );
}