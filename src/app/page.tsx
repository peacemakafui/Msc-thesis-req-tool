import Link from "next/link";
import { FileText, MessageSquare, Upload, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            LLM Requirements
            <span className="text-blue-600 dark:text-blue-400 ml-2">Gatherer</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Enhance your software requirements gathering with AI-powered tools. 
            Upload documents, chat with AI, and generate structured requirements effortlessly.
          </p>
        </header>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto">
          {/* Upload Documents */}
          <Link href="/dashboard/upload" className="group">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 group-hover:-translate-y-1">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Upload Documents
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Upload PDF or Word documents to extract and analyze requirements automatically.
              </p>
            </div>
          </Link>

          {/* Chat with AI */}
          <Link href="/dashboard/chat" className="group">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 group-hover:-translate-y-1">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg mb-4 group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                <MessageSquare className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Chat with AI
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Describe your project, paste notes, or discuss requirements with our AI assistant.
              </p>
            </div>
          </Link>

          {/* View Requirements */}
          <Link href="/dashboard/requirements" className="group">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200 group-hover:-translate-y-1">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg mb-4 group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                View Requirements
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Review, edit, and manage all your generated software requirements.
              </p>
            </div>
          </Link>
        </div>

        {/* Features Section */}
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-12">
          <div className="flex items-center mb-6">
            <Sparkles className="w-8 h-8 text-yellow-500 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              AI-Powered Features
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Document Analysis
              </h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  PDF & Word document processing
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Automatic text extraction
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
                  Intelligent requirement identification
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Smart Requirements
              </h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Functional & non-functional requirements
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  User stories & acceptance criteria
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                  Priority classification
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Get Started Button */}
        <div className="text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-8 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
          >
            Get Started
            <svg className="ml-2 -mr-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
