import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-2">
          <div className="font-bold text-xl text-kestra-blue">Kestra Integration</div>
        </Link>
        
        <div className="flex items-center space-x-6">
          <Link 
            href="/" 
            className="text-gray-700 hover:text-kestra-blue transition-colors"
          >
            Dashboard
          </Link>
          <Link 
            href="/workflows" 
            className="text-gray-700 hover:text-kestra-blue transition-colors"
          >
            Workflows
          </Link>
          <Link 
            href="/executions" 
            className="text-gray-700 hover:text-kestra-blue transition-colors"
          >
            Executions
          </Link>
          <a 
            href={process.env.NEXT_PUBLIC_KESTRA_URL || 'https://kestra.coderstudio.co'} 
            target="_blank"
            rel="noopener noreferrer"
            className="bg-kestra-blue text-white px-4 py-2 rounded-md hover:bg-kestra-dark transition-colors"
          >
            Kestra UI
          </a>
        </div>
      </div>
    </nav>
  );
}