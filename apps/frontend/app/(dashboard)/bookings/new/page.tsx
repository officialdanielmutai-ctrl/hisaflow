'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import useSWR from 'swr';
import { roomsService, type Room } from '@/services/rooms.service';
import { guestsService, type Guest } from '@/services/guests.service';
import { bookingsService } from '@/services/bookings.service';
import { ArrowLeft, ArrowRight, Bed, User, CalendarDays, Loader2, Check, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AddGuestSheet } from '@/components/guesthouse/AddGuestSheet';

type Step = 'room' | 'guest' | 'dates';

export default function NewBookingPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();

  const [step, setStep] = useState<Step>('room');
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [dates, setDates] = useState({ checkIn: '', checkOut: '', notes: '' });

  const { data: rooms } = useSWR<Room[]>(
    membership ? 'rooms-list' : null,
    async () => {
      const token = await getToken();
      if (!token || !membership) throw new Error('Not authenticated');
      return roomsService.getAll(token, membership.organization.id);
    }
  );

  const { data: guests, mutate: mutateGuests } = useSWR<Guest[]>(
    membership ? 'guests-list' : null,
    async () => {
      const token = await getToken();
      if (!token || !membership) throw new Error('Not authenticated');
      return guestsService.getAll(token, membership.organization.id);
    }
  );

  React.useEffect(() => {
    if (!rooms || !guests) return;

    const params = new URLSearchParams(window.location.search);
    const guestName = params.get('guestName');
    const roomName = params.get('roomName');
    const checkIn = params.get('checkIn');
    const checkOut = params.get('checkOut');

    let matchedRoom = selectedRoom;
    let matchedGuest = selectedGuest;

    if (roomName && !selectedRoom) {
      const found = rooms.find(r => r.name.toLowerCase() === roomName.toLowerCase());
      if (found) {
        setSelectedRoom(found);
        matchedRoom = found;
      }
    }

    if (guestName && !selectedGuest) {
      const found = guests.find(g => g.name.toLowerCase() === guestName.toLowerCase());
      if (found) {
        setSelectedGuest(found);
        matchedGuest = found;
      }
    }

    if ((checkIn || checkOut) && !dates.checkIn && !dates.checkOut) {
      setDates(prev => ({
        ...prev,
        checkIn: checkIn || prev.checkIn,
        checkOut: checkOut || prev.checkOut,
      }));
    }

    if (matchedRoom && matchedGuest) {
      setStep('dates');
    } else if (matchedRoom) {
      setStep('guest');
    }
  }, [rooms, guests]);


  const steps: Step[] = ['room', 'guest', 'dates'];
  const stepIndex = steps.indexOf(step);

  const handleSubmit = async () => {
    if (!selectedRoom || !selectedGuest || !dates.checkIn || !dates.checkOut) return;
    setSubmitting(true);
    setError('');

    try {
      const token = await getToken();
      if (!token || !membership) throw new Error('Not authenticated');

      const booking = await bookingsService.create(
        {
          roomId: selectedRoom.id,
          guestId: selectedGuest.id,
          checkInDate: new Date(dates.checkIn).toISOString(),
          checkOutDate: new Date(dates.checkOut).toISOString(),
          ratePerNight: Number(selectedRoom.baseRate),
          notes: dates.notes || undefined,
        },
        token,
        membership.organization.id
      );

      router.push(`/bookings/${booking.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create booking');
      setSubmitting(false);
    }
  };

  const currency = membership?.organization?.currency || 'KES';

  return (
    <div className="flex flex-col h-full bg-gray-50/50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/bookings" className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">New Booking</h1>
            <p className="text-sm text-gray-500">Step {stepIndex + 1} of {steps.length}</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mt-4">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 ${i <= stepIndex ? 'text-[var(--color-primary)]' : 'text-gray-300'}`}>
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  i < stepIndex
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                    : i === stepIndex
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-gray-200 text-gray-300'
                }`}>
                  {i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className="text-xs font-medium capitalize hidden sm:block">{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 ${i < stepIndex ? 'bg-[var(--color-primary)]' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {error && (
          <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl">
            {error}
          </div>
        )}

        {/* Step 1: Select Room */}
        {step === 'room' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Select a Room</h2>
            {rooms?.filter(r => r.isActive && r.status !== 'OCCUPIED' && r.status !== 'MAINTENANCE').map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                  selectedRoom?.id === room.id
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${selectedRoom?.id === room.id ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <Bed className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{room.name}</div>
                  <div className="text-xs text-gray-500">{room.type}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">{currency} {Number(room.baseRate).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">per night</div>
                </div>
                {selectedRoom?.id === room.id && (
                  <div className="h-5 w-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>
            ))}
            {!rooms?.length && (
              <div className="text-center py-8 text-gray-500 text-sm">No available rooms found.</div>
            )}
          </div>
        )}

        {/* Step 2: Select Guest */}
        {step === 'guest' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Select Guest</h2>
              <button
                onClick={() => setShowAddGuest(true)}
                className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:underline"
              >
                <Plus className="h-4 w-4" />
                New Guest
              </button>
            </div>
            <div className="space-y-3">
              {guests?.map((guest) => (
                <button
                  key={guest.id}
                  onClick={() => setSelectedGuest(guest)}
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                    selectedGuest?.id === guest.id
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                  }`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-base ${
                    selectedGuest?.id === guest.id ? 'bg-[var(--color-primary)] text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {guest.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{guest.name}</div>
                    {guest.phone && <div className="text-xs text-gray-500">{guest.phone}</div>}
                  </div>
                  {selectedGuest?.id === guest.id && (
                    <div className="h-5 w-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
              {!guests?.length && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No guests found.{' '}
                  <button onClick={() => setShowAddGuest(true)} className="text-[var(--color-primary)] font-medium">Add one</button>.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Dates & Notes */}
        {step === 'dates' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-900">Dates & Details</h2>

            {/* Summary Card */}
            <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Bed className="h-4 w-4 text-[var(--color-primary)]" />
                <span className="text-sm font-medium text-gray-900">{selectedRoom?.name} · {selectedRoom?.type}</span>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-[var(--color-primary)]" />
                <span className="text-sm font-medium text-gray-900">{selectedGuest?.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-[var(--color-primary)] ml-0.5">{currency}</span>
                <span className="text-sm font-medium text-gray-900">{Number(selectedRoom?.baseRate).toLocaleString()} / night</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-In Date</label>
              <input
                type="date"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                value={dates.checkIn}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDates({ ...dates, checkIn: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-Out Date</label>
              <input
                type="date"
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
                value={dates.checkOut}
                min={dates.checkIn || new Date().toISOString().split('T')[0]}
                onChange={(e) => setDates({ ...dates, checkOut: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all resize-none"
                rows={3}
                placeholder="Special requests, preferences..."
                value={dates.notes}
                onChange={(e) => setDates({ ...dates, notes: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="p-4 border-t border-gray-100 bg-white flex gap-3">
        {stepIndex > 0 && (
          <button
            onClick={() => setStep(steps[stepIndex - 1])}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}

        {step !== 'dates' ? (
          <button
            onClick={() => {
              if (step === 'room' && !selectedRoom) return;
              if (step === 'guest' && !selectedGuest) return;
              setStep(steps[stepIndex + 1]);
            }}
            disabled={(step === 'room' && !selectedRoom) || (step === 'guest' && !selectedGuest)}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-medium bg-[var(--color-primary)] hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || !dates.checkIn || !dates.checkOut}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-medium bg-[var(--color-primary)] hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4" />
                Confirm Booking
              </>
            )}
          </button>
        )}
      </div>

      <AddGuestSheet
        isOpen={showAddGuest}
        onClose={() => {
          setShowAddGuest(false);
          mutateGuests();
        }}
      />
    </div>
  );
}
