import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/client';
import { notificationService } from '../../services/notifications';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { platform } from '../../utils/platform';
import toast from 'react-hot-toast';

interface DeviceInfo {
  device_id: string;
  device_name: string;
  device_type: 'web' | 'android' | 'ios';
  updated_at: string;
}

export const DeviceManagement = ({ userId }: { userId: string }) => {
  const [isUnregisteringAll, setIsUnregisteringAll] = useState(false);
  const queryClient = useQueryClient();

  // Get registered devices
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
    
  // Mutation for unregistering a device completely
  const unregisterDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      console.log(`Starting unregistration process for device: ${deviceId}`);
      await notificationService.unsubscribeFromPushNotifications(userId, deviceId, true);
      
      // Check if this was the last device
      const { data: remainingDevices } = await supabase
        .from('push_subscriptions')
        .select('device_id')
        .eq('user_id', userId);
        
      // If no devices remain, disable global notifications
      if (!remainingDevices || remainingDevices.length === 0) {
        const { error: updateError } = await supabase
          .from('user_preferences')
          .update({ notification_enabled: false })
          .eq('user_id', userId);
          
        if (updateError) throw updateError;
      }
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['devices', userId] });

      // Snapshot the previous value
      const previousDevices = queryClient.getQueryData(['devices', userId]);

      // Update devices list optimistically
      queryClient.setQueryData(['devices', userId], (old: DeviceInfo[] | undefined) => {
        if (!old) return old;
        return [];
      });

      return { previousDevices };
    },
    onSuccess: () => {
      toast.success('Device unregistered successfully');
    },
    onError: (error: Error, _variables, context) => {
      console.error('Failed to unregister device:', error);
      toast.error('Failed to unregister device');
      
      // Restore the previous state on error
      if (context?.previousDevices) {
        queryClient.setQueryData(['devices', userId], context.previousDevices);
      }
    },
    onSettled: () => {
      // Invalidate queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['devices', userId], exact: true });
      queryClient.invalidateQueries({ queryKey: ['preferences', userId], exact: true });
    }
  });

  // Mutation for unregistering all devices
  const unregisterAllDevicesMutation = useMutation({
    mutationFn: async () => {
      console.log('Starting unregistration process for all devices...');
      setIsUnregisteringAll(true);
      try {
        // Clean up all device registrations
        console.log('Removing all device registrations...');
        const { error: deleteError } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId);
        
        if (deleteError) throw deleteError;
        
        // Clean up current device's Firebase instance
        console.log('Cleaning up current device Firebase instance...');
        await notificationService.cleanupAllDevices();
        
        // Disable global notifications since no devices exist
        const { error: updateError } = await supabase
          .from('user_preferences')
          .update({ notification_enabled: false })
          .eq('user_id', userId);
          
        if (updateError) throw updateError;
        
        console.log('Successfully removed all devices');
      } finally {
        setIsUnregisteringAll(false);
      }
    },
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['devices', userId] });

      // Snapshot the previous value
      const previousDevices = queryClient.getQueryData(['devices', userId]);

      // Update devices list optimistically
      queryClient.setQueryData(['devices', userId], (old: DeviceInfo[] | undefined) => {
        if (!old) return old;
        return [];
      });

      return { previousDevices };
    },
    onSuccess: () => {
      toast.success('All devices unregistered successfully');
    },
    onError: (error: Error, _variables, context) => {
      console.error('Failed to unregister all devices:', error);
      toast.error('Failed to unregister all devices');

      // Restore the previous state on error
      if (context?.previousDevices) {
        queryClient.setQueryData(['devices', userId], context.previousDevices);
      }
    },
    onSettled: () => {
      // Invalidate queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['devices', userId], exact: true });
      queryClient.invalidateQueries({ queryKey: ['preferences', userId], exact: true });
    }
  });

  const formatDeviceType = (type: 'web' | 'android' | 'ios') => {
    switch (type) {
      case 'android':
        return 'Android';
      case 'ios':
        return 'iOS';
      case 'web':
        return 'Desktop';
      default:
        return type;
    }
  };

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
    <div>
      <div className="flex flex-col space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <label className="text-gray-900 dark:text-gray-100 font-medium">
              Registered Devices
            </label>
            <p className="text-sm text-gray-600/90 dark:text-gray-400 mt-1">
              Manage your notification-enabled devices
            </p>
          </div>
          {devices && devices.length > 0 && (
            <button
              onClick={() => unregisterAllDevicesMutation.mutate()}
              disabled={isUnregisteringAll}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-100/50 dark:border-red-900/50 rounded-lg shadow-sm dark:shadow-sm hover:shadow-md dark:hover:shadow-lg active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
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
          <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-100/30 dark:border-gray-800/30 p-4 transition-colors hover:bg-white/50 dark:hover:bg-gray-900/50">
            <p className="text-gray-600/90 dark:text-gray-400 text-sm">
              No devices registered for notifications.
            </p>
          </div>
        ) : (
          <div className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-100/30 dark:border-gray-800/30 overflow-hidden divide-y divide-gray-100/50 dark:divide-gray-800/50 pr-0">
            {devices.map((device) => (
              <div
                key={device.device_id}
                className="py-4 pl-4 pr-0 flex flex-col sm:flex-row sm:items-start gap-4 hover:bg-white/50 dark:hover:bg-gray-900/50 transition-colors duration-200"
              >
                <div className="flex-grow flex flex-col space-y-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formatDeviceType(device.device_type)}
                  </p>
                  <p className="text-xs text-gray-600/90 dark:text-gray-400">
                    {(() => {
                      try {
                        const deviceInfo = platform.parseDeviceId(device.device_id);
                        return (
                          <>
                            {deviceInfo.deviceType === 'Web' ? (
                              <>
                                <span className="font-medium">{deviceInfo.browser}</span>
                              </>
                            ) : (
                              <>
                                <span className="font-medium">{deviceInfo.installType}</span>
                                {' • '}
                                <span>{deviceInfo.brand}</span>
                              </>
                            )}
                          </>
                        );
                      } catch {
                        return 'Unknown Device';
                      }
                    })()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Last used: {formatLastUsed(device.updated_at)}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => unregisterDeviceMutation.mutate(device.device_id)}
                    disabled={unregisterDeviceMutation.isPending}
                    className="w-full sm:w-auto inline-flex items-center justify-center pl-4 pr-4 sm:pr-3 py-2 text-sm font-medium text-red-600 dark:text-red-500 bg-red-50/80 dark:bg-red-900/20 hover:bg-red-100/80 dark:hover:bg-red-900/30 border border-red-100/40 dark:border-red-900/50 rounded-lg shadow-sm dark:shadow-sm hover:shadow-md dark:hover:shadow-lg active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};