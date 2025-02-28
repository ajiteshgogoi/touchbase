import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/client';
import { notificationService } from '../../services/notifications';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { platform, DeviceType } from '../../utils/platform';
import toast from 'react-hot-toast';

interface DeviceInfo {
  device_id: string;
  device_name: string;
  device_type: DeviceType;
  updated_at: string;
}

export const DeviceManagement = ({ userId }: { userId: string }) => {
  const [isUnregisteringAll, setIsUnregisteringAll] = useState(false);
  const queryClient = useQueryClient();

  // Fetch registered devices
  const { data: devices, isLoading } = useQuery({
    queryKey: ['devices', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('device_id, device_name, device_type, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as DeviceInfo[];
    },
    enabled: !!userId
  });

  // Mutation for unregistering a single device
  const unregisterDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      await notificationService.unsubscribeFromPushNotifications(userId, deviceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', userId] });
      toast.success('Device unregistered successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to unregister device:', error);
      toast.error('Failed to unregister device');
    }
  });

  // Mutation for unregistering all devices
  const unregisterAllDevicesMutation = useMutation({
    mutationFn: async () => {
      setIsUnregisteringAll(true);
      try {
        // First cleanup current device's Firebase instance
        await notificationService.cleanupAllDevices();
        
        // Then delete all device registrations from the database
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId);
        
        if (error) throw error;
      } finally {
        setIsUnregisteringAll(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices', userId] });
      toast.success('All devices unregistered successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to unregister all devices:', error);
      toast.error('Failed to unregister all devices');
    }
  });

  const formatLastUsed = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="border-t border-gray-100/50 pt-6 mt-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex flex-col">
              <label className="text-gray-900 font-medium">
                Registered Devices
              </label>
              <p className="text-sm text-gray-600/90 mt-1">
                Manage your notification-enabled devices
              </p>
            </div>
          </div>
          {devices && devices.length > 0 && (
            <button
              onClick={() => unregisterAllDevicesMutation.mutate()}
              disabled={isUnregisteringAll}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600/90 bg-red-50/90 hover:bg-red-100/90 border border-red-100/50 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
            >
              {isUnregisteringAll ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner />
                  <span>Unregistering...</span>
                </div>
              ) : (
                'Unregister All'
              )}
            </button>
          )}
        </div>

        {(!devices || devices.length === 0) ? (
          <div className="bg-white/40 backdrop-blur-sm rounded-xl border border-gray-100/30 pl-6 py-4 transition-colors hover:bg-white/50">
            <p className="text-gray-600/90 text-sm">No devices registered for notifications.</p>
          </div>
        ) : (
          <div className="bg-white/40 backdrop-blur-sm rounded-xl border border-gray-100/30 overflow-hidden divide-y divide-gray-100/50">
            {devices.map((device) => (
              <div
                key={device.device_id}
                className="py-4 pl-6 flex items-center justify-between hover:bg-white/50 transition-colors duration-200"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">
                    {platform.formatDeviceType(device.device_type)}
                  </p>
                  <p className="text-xs text-gray-600/90">
                    Last used: {formatLastUsed(device.updated_at)}
                  </p>
                </div>
                <button
                  onClick={() => unregisterDeviceMutation.mutate(device.device_id)}
                  disabled={unregisterDeviceMutation.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-red-600/80 bg-red-50/80 hover:bg-red-100/80 border border-red-100/40 rounded-lg shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                >
                  {unregisterDeviceMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <LoadingSpinner />
                      <span>Unregistering...</span>
                    </div>
                  ) : (
                    'Unregister'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};