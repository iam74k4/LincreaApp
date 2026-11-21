// マイアプリの一覧を、どの外部 API から取るか。画面はここだけを使い、相手（いまは EZCraft）を知らない。
// 別の API（社内の API など）から取るようにするときは、src/api/<相手>/ に一覧を取る関数を作り、
// ここで差し替える（どの相手でも、アプリの形 MyApp（src/models/myApp.ts）にして返す）。
export { fetchMyApps } from '../api/ezcraft/myApps';
