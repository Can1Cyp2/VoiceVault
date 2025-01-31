// file app/util/network.ts

import * as Network from "expo-network";

export const checkInternetConnection = async () => {
  const networkState = await Network.getNetworkStateAsync();
  return networkState.isConnected;
};
