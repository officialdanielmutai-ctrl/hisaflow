'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import useSWR from 'swr';
import { guestsService, type Guest } from '@/services/guests.service';
import { ArrowLeft, User, Phone, Mail, Edit3, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { EditGuestSheet } from '@/components/guesthouse/EditGuestSheet';

export default function GuestDetailPage({ params }: { params: { id: string } }) {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();

  const [showEdit, setShowEdit] = useState(false);

  const { data: guest, isLoading } = useSWR<Guest>(
    membership ? `guest-${params.id}` : null,
    async () => {
      const token = await getToken();
      if (!token || !membership) throw new Error('Not authenticated');
      return guestsService.getById(params.id, token, membership.organization.id);
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="p-6 text-center text-gray-500">
        Guest not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/guests" className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Guest Profile</h1>
          </div>
          <button
            onClick={() => setShowEdit(true)}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <Edit3 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Profile Details */}
      <div className="p-4 sm:p-6 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center">
          <div className="h-20 w-20 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)] font-bold text-3xl mb-4">
            {guest.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{guest.name}</h2>
          {guest.idNumber && (
            <p className="text-sm text-gray-500 font-medium">ID: {guest.idNumber}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Contact Info</h3>
          
          <div className="flex items-center gap-4">
            <div className="bg-gray-50 p-2 rounded-lg text-gray-500">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Phone Number</div>
              <div className="text-sm font-medium text-gray-900">{guest.phone || 'Not provided'}</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-gray-50 p-2 rounded-lg text-gray-500">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-gray-500">Email Address</div>
              <div className="text-sm font-medium text-gray-900">{guest.email || 'Not provided'}</div>
            </div>
          </div>
        </div>

        {guest.notes && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Notes</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{guest.notes}</p>
          </div>
        )}
      </div>

      <EditGuestSheet guest={guest} isOpen={showEdit} onClose={() => setShowEdit(false)} />
    </div>
  );
}
