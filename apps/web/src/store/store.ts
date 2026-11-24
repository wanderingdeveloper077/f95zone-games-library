import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { gamesReducer } from "./slices/gamesSlice";
import { systemReducer } from "./slices/systemSlice";

const rootReducer = combineReducers({
  games: gamesReducer,
  system: systemReducer,
});

export function createAppStore() {
  return configureStore({
    reducer: rootReducer,
  });
}

export const store = createAppStore();

export type AppStore = typeof store;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore["dispatch"];
