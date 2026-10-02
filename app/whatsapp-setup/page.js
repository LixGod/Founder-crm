import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, CheckCircle2 } from 'lucide-react';

export default function WhatsAppSetupGuide() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto bg-white p-10 rounded-3xl shadow-sm border border-slate-200">
        <Link href="/" className="inline-flex items-center text-sm font-bold text-slate-400 hover:text-slate-800 transition-colors mb-8 uppercase tracking-widest">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to App
        </Link>
        
        <h1 className="text-3xl font-black text-slate-900 mb-4">WhatsApp API Setup Guide</h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          To send automated WhatsApp messages from your own phone number, you need to connect your Meta Developer account. Follow these simple steps to generate your permanent token and Phone ID.
        </p>

        <div className="space-y-8">
          <Step 
            number="1" 
            title="Create a Meta Developer App"
            description={
              <ul className="list-disc list-inside space-y-2 text-slate-600 text-sm mt-3">
                <li>Go to <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline inline-flex items-center">Meta for Developers <ExternalLink className="w-3 h-3 ml-1" /></a> and log in.</li>
                <li>Click <strong>My Apps</strong> (top right) and click <strong>Create App</strong>.</li>
                <li>Select <strong>Other</strong> &rarr; <strong>Business</strong>.</li>
                <li>Name your app (e.g., &quot;My CRM App&quot;) and select your Business Account if you have one.</li>
              </ul>
            }
          />

          <Step 
            number="2" 
            title="Set Up WhatsApp Product"
            description={
              <ul className="list-disc list-inside space-y-2 text-slate-600 text-sm mt-3">
                <li>On your App Dashboard, scroll down to &quot;Add products to your app&quot;.</li>
                <li>Find <strong>WhatsApp</strong> and click <strong>Set Up</strong>.</li>
                <li>In the left sidebar, navigate to <strong>WhatsApp &rarr; API Setup</strong>.</li>
                <li>Here, you will see a <strong>Phone Number ID</strong>. Copy this and paste it into your CRM Settings.</li>
              </ul>
            }
          />

          <Step 
            number="3" 
            title="Generate a Permanent Access Token"
            description={
              <div className="mt-3 text-sm text-slate-600 space-y-3">
                <p>The token shown on the API Setup page is temporary (expires in 24 hours). You need a permanent token:</p>
                <ul className="list-disc list-inside space-y-2">
                  <li>Go to <a href="https://business.facebook.com/settings" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline inline-flex items-center">Meta Business Settings <ExternalLink className="w-3 h-3 ml-1" /></a>.</li>
                  <li>On the left sidebar, go to <strong>Users &rarr; System Users</strong>.</li>
                  <li>Click <strong>Add</strong> to create a new user, name it, and set the role to <strong>Admin</strong>.</li>
                  <li>Click <strong>Add Assets</strong> &rarr; <strong>Apps</strong> &rarr; Select your newly created App &rarr; Enable <strong>Full Control (Manage App)</strong> and save.</li>
                  <li>Click <strong>Generate New Token</strong>.</li>
                  <li>Select your app. Set expiration to <strong>Never</strong>.</li>
                  <li>Check these two permissions: <code className="bg-slate-100 px-2 py-0.5 rounded text-pink-600">whatsapp_business_messaging</code> and <code className="bg-slate-100 px-2 py-0.5 rounded text-pink-600">whatsapp_business_management</code>.</li>
                  <li>Click <strong>Generate Token</strong>. <strong className="text-rose-600">Copy this immediately</strong> and paste it into your CRM Settings. It will only be shown once!</li>
                </ul>
              </div>
            }
          />

          <Step 
            number="4" 
            title="Add Your Real Phone Number"
            description={
              <div className="mt-3 text-sm text-slate-600 space-y-3">
                <p>To message clients, you must use a real number (not the test number provided by Meta).</p>
                <ul className="list-disc list-inside space-y-2">
                  <li>In your Meta App Dashboard, go to <strong>WhatsApp &rarr; API Setup</strong>.</li>
                  <li>Scroll down and click <strong>Add Phone Number</strong>.</li>
                  <li>Follow the prompts to verify your real business number via SMS or Voice Call.</li>
                  <li>Once verified, make sure you update your <strong>Phone Number ID</strong> in the CRM Settings to match this new real number!</li>
                </ul>
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl mt-4 text-xs font-medium">
                  Note: The phone number you use cannot be actively registered on the standard WhatsApp or WhatsApp Business mobile app. You must delete the account from your mobile app first.
                </div>
              </div>
            }
          />
        </div>

        <div className="mt-12 p-6 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-4">
          <CheckCircle2 className="w-6 h-6 text-indigo-600 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-slate-900 mb-1">All Done?</h3>
            <p className="text-sm text-slate-600">
              Once you have your <strong className="text-slate-800">Permanent Token</strong> and <strong className="text-slate-800">Phone Number ID</strong>, head back to the Settings page in the CRM to save them securely.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

function Step({ number, title, description }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
        {number}
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        {description}
      </div>
    </div>
  );
}
