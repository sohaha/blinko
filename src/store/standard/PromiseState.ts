import { EventEmitter } from "events";
import { makeAutoObservable, makeObservable } from "mobx";
import { RootStore } from "../root";
import { BaseState, BooleanState, NumberState } from "./base";
import { useEffect } from "react";
import { ToastPlugin } from "../module/Toast/Toast";
import { eventBus } from "@/lib/event";
import { BlinkoStore } from "../blinkoStore";
import i18n from "@/lib/i18n";

export interface Events {
  data: (data: any) => void;
  error: (error: any) => void;
  select: (index: number) => void;
  update: () => void;
  finally: () => void;
  wait: () => void;
}

export const PromiseCall = async (f: Promise<any>) => {
  const r = await (new PromiseState({
    autoAlert: true,
    successMsg: i18n.t('update-successfully'),
    function: async () => {
      return await f;
    }
  })).call()
  RootStore.Get(BlinkoStore).updateTicker++
  return r
}

export class PromiseState<T extends (...args: any[]) => Promise<any>, U = ReturnType<T>> {
  sid = "PromiseState";
  key?: string;
  loading = new BooleanState();
  //@ts-ignore
  value?: Awaited<U> = null;
  defaultValue: any = null;
  function: T;
  autoAlert = true;
  autoUpdate = false;
  autoInit = false;
  autoClean = false;
  context: any = undefined;

  successMsg: string = "";
  errMsg: string = "";

  loadingLock = true;

  // event plugin
  event = new EventEmitter();

  on<E extends keyof Events>(event: E, listener: Events[E]) {
    this.event.on(event, listener);
    return this;
  }

  once<E extends keyof Events>(event: E, listener: Events[E]) {
    this.event.once(event, listener);
    return this;
  }

  use<E extends keyof Events>(event: E, listener: Events[E]) {
    useEffect(() => {
      this.event.on(event, listener);
      return () => {
        this.event.off(event, listener);
      };
    }, []);

    return () => this.event.off(event, listener);
  }

  emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>) {
    this.event.emit(event, ...args);
  }

  // init plugin
  init: () => Promise<void>;

  // list selector plugin
  currentIndex: BaseState = new NumberState({ value: 0 });
  get current() {
    if (Array.isArray(this.value) && this.value.length > 0 && !this.value[this.currentIndex.value]) {
      this.currentIndex.setValue(0);
    }
    //@ts-ignore
    return this.value[this.currentIndex.value];
  }

  _onSelect(index: number) {
    this.currentIndex.setValue(index);
    this.event.emit("select", index);
    this.event.emit("update");
  }

  onSelect(index: number) {
    this._onSelect(index);
  }

  toJSON() {
    return {
      value: this.value,
    };
  }

  //@ts-ignore
  async waitItem(): Promise<Awaited<U>[0]> {
    await this.wait();
    return this.current;
  }

  // wait hook plugin
  async wait({ call = false } = {}): Promise<Awaited<U>> {
    return new Promise<Awaited<U>>((res, rej) => {
      if (this.value) {
        if (Array.isArray(this.value)) {
          if (this.value.length > 0) {
            res(this.value);
          }
        } else {
          res(this.value);
        }
      }

      //@ts-ignore
      if (call && !this.loading.value) this.call();
      this.event.emit("wait");
      this.event.once("data", res);
      this.event.on("error", rej);
    });
  }

  constructor(args: Partial<PromiseState<T, U>> = {}) {
    Object.assign(this, args);
    if (this.defaultValue) {
      this.value = this.defaultValue;
    }
    if (this.key) {
      RootStore.init().add(this, { sid: this.key });
    } else {
      makeAutoObservable(this);
    }
  }

  async setValue(val) {
    let _val = val;
    this.value = _val;
    this.event.emit("data", val);
    this.event.emit("update");
  }

  async getOrCall(...args: Parameters<T>): Promise<Awaited<U> | undefined> {
    if (this.value) {
      if (Array.isArray(this.value)) {
        if (this.value.length > 0) {
          return this.value;
        } else {
          return this.call(...args);
        }
      } else {
        return this.value;
      }
    } else {
      return this.call(...args);
    }
  }

  async call(...args: Parameters<T>): Promise<Awaited<U> | undefined> {
    const toast = RootStore.Get(ToastPlugin);
    try {
      if (this.loadingLock && this.loading.value == true) return;
      this.loading.setValue(true);
      const res = await this.function.apply(this.context, args);
      this.setValue(res);
      if (this.autoAlert && this.successMsg && res) {
        toast.success(this.successMsg);
      }
      return res;
    } catch (error) {
      if (this.autoAlert) {
        const message = error.message;
        if (message.includes("Forbidden")) {
          toast.dismiss();
          // toast.error(message, {
          //   id: "UNAUTHORIZED",
          // });
          eventBus.emit('user:signout')
          this.signOut?.();
        } else {
          this.errMsg = message;
          toast.error(message);
        }
      } else {
        this.event.emit("error", error);
        throw error;
      }
    } finally {
      this.event.emit("finally");
      this.loading.setValue(false);
    }
  }

  // 401 403
  signOut: () => void;
}

export class PromisePageState<T extends (...args: any) => Promise<any>, U = ReturnType<T>> {
  page: number = 1;
  size: number = 10;
  sid = "PromisePageState";
  key?: string;
  loading = new BooleanState();
  isLoadAll: boolean = false;
  get isEmpty() {
    if (this.value == null) return true
    if (this.loading.value) return false
    //@ts-ignore
    return this.value?.length == 0
  }
  get isLoading() {
    return this.loading.value
  }
  //@ts-ignore
  value?: Awaited<U> = [];
  defaultValue: any = [];
  function: T;

  autoAlert = true;
  autoUpdate = false;
  autoInit = false;
  autoClean = false;
  context: any = undefined;

  successMsg: string = "";
  errMsg: string = "";

  loadingLock = true;

  toJSON() {
    return {
      value: this.value,
    };
  }

  constructor(args: Partial<PromisePageState<T, U>> = {}) {
    Object.assign(this, args);
    if (this.defaultValue) {
      this.value = this.defaultValue;
    }
    if (this.key) {
      RootStore.init().add(this, { sid: this.key });
    } else {
      makeAutoObservable(this);
    }
  }

  async setValue(val) {
    let _val = val;
    this.value = _val;
  }

  private async call(...args: Parameters<T>): Promise<Awaited<U> | undefined> {
    const toast = RootStore.Get(ToastPlugin);
    try {
      if (this.loadingLock && this.loading.value == true) return;
      this.loading.setValue(true);
      if (args?.[0]) {
        Object.assign(args?.[0], { page: this.page, size: this.size })
      } else {
        args[0] = { page: this.page, size: this.size }
      }
      if (this.isLoadAll) return this.value
      const res = await this.function.apply(this.context, args);
      if (!Array.isArray(res)) throw new Error("PromisePageState function must return array")
      if (res.length == 0) {
        this.isLoadAll = true
        if (this.page == 1) {
          this.setValue(null);
        }
        //@ts-ignore
        return this.value
      }
      if (res.length == this.size) {
        if (this.page == 1) {
          this.setValue(res);
        } else {
          //@ts-ignore
          this.setValue(this.value!.concat(res));
        }
      } else {
        if (this.page == 1) {
          this.setValue(res);
          this.isLoadAll = true
        } else {
          //@ts-ignore
          this.setValue(this.value!.concat(res));
          this.isLoadAll = true
        }
      }

      if (this.autoAlert && this.successMsg && res) {
        toast.success(this.successMsg);
      }
      return this.value;
    } catch (error) {
      if (this.autoAlert) {
        const message = error.message;
        if (message.includes("Forbidden")) {
          toast.dismiss();
          eventBus.emit('user:signout')
        } else {
          this.errMsg = message;
          toast.error(message);
        }
      } else {
        throw error;
      }
    } finally {
      this.loading.setValue(false);
    }
  }

  async resetAndCall(...args: Parameters<T>): Promise<Awaited<U> | undefined> {
    this.isLoadAll = false
    this.page = 1
    //@ts-ignore
    return await this.call(...args)
  }
  async callNextPage(...args: Parameters<T>): Promise<Awaited<U> | undefined> {
    if (this.loading.value) return
    this.page++
    //@ts-ignore
    return await this.call(...args)
  }
}