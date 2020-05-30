// ===============
const dontSupportIndexedDB = Symbol("dontSupportIndexedDB");
const isDontSupportIndexedDB = () => window[dontSupportIndexedDB];
((global: any) => {
    if (!global) {
        return;
    }
    // In the following line, you should include the prefixes of implementations you want to test.
    global.indexedDB = global.indexedDB || global.mozIndexedDB || global.webkitIndexedDB || global.msIndexedDB;
    // DON'T use "var indexedDB = ..." if you're not in a function.
    // Moreover, you may need references to some global.IDB* objects:
    global.IDBTransaction = global.IDBTransaction || global.webkitIDBTransaction || global.msIDBTransaction;
    global.IDBKeyRange = global.IDBKeyRange || global.webkitIDBKeyRange || global.msIDBKeyRange;
    // (Mozilla has never prefixed these objects, so we don't need window.mozIDB*)
    if (!global.indexedDB) {
        // tslint:disable-next-line
        console.warn(`
******* WARNING *******
Your browser doesn't support a stable version of IndexedDB. Such and such feature will not be available.
******* WARNING *******`);
        global[dontSupportIndexedDB] = true;
    }
    // tslint:disable-next-line
})(window || this);

// ===============

export const InDB = () => {
    // 做低版本兼容，如果没法用indexdb就用localstorage代替
};

const SupportIndexedDB = () => {
    return (target, methodName: string, descriptor: PropertyDescriptor) => {
        if (isDontSupportIndexedDB()) {
            target[methodName] = () => Promise.resolve(null);
            return;
        }
    };
};

const IDBRequest2Promise = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

/**
 * 这里我们限制了主键的用法，不能使用keypath模式
 * 所有表都是自增主键
 * 因为我们可以指定索引因此也完全美必要在主键上做文章，就像mangodb那样
 *
 * 并且也抛弃了对于版本的操作，版本将在每次增加新表的时候自增
 *
 * 同时，我们的查询操作也弱化了事务的定义，
 * 从而支持高级的 js 生成器语法
 */

export class InDBInstance {
    public databaseName: string;

    private regStoreObjectList: Array<[string, IDBObjectStoreParameters]>;
    // 当发现表不存在的时候就自增version 然后创建表
    private version: number;

    constructor(databaseName: string) {
        this.databaseName = databaseName;
        this.version = 1;
    }

    @SupportIndexedDB()
    public async use(
        ObjectStoreName: string | string[],
        mode: IDBTransactionMode = "readonly",
    ): Promise<IDBTransaction> {
        const db = await this.getDB();

        try {
            return db.transaction(ObjectStoreName, mode);
        } catch (err) {
            if (err.name === "NotFoundError") {
                db.close();
                this.version += 1;
                if (Array.isArray(ObjectStoreName)) {
                    const arr = ObjectStoreName
                        .filter((n) => !this.regStoreObjectList.find(([name]) => name === n))
                        .map((name) => [name, { autoIncrement: true }] as [string, IDBObjectStoreParameters]);
                    this.regStoreObjectList.push(...arr);
                } else {
                    this.regStoreObjectList.push([ObjectStoreName, { autoIncrement: true }]);
                }
                return this.use(ObjectStoreName, mode);
            }
            return Promise.resolve(null);
        }
    }

    public store<T extends object>(name: string) {
        return new InDBStore<T>(name, this);
    }

    @SupportIndexedDB()
    private getDB() {
        const { databaseName, version, regStoreObjectList } = this;
        return new Promise<IDBDatabase>((resolve, reject) => {
            const request = window.indexedDB.open(databaseName, version);
            let db: IDBDatabase;
            request.onsuccess = (ev) => {
                db = request.result;
                resolve(db);
            };
            request.onupgradeneeded = (ev) => {
                db = (ev.target as any).result as IDBDatabase;
                regStoreObjectList.forEach(([name, params]) => {
                    if (db.objectStoreNames.contains(name)) {
                        return;
                    }
                    db.createObjectStore(name, params);
                });
                resolve(db);
            };
            request.onerror = () => reject(request.error);
        });
    }
}

class InDBStore<StoreType extends object = { [key: string]: any }> {
    public name: string;
    public db: InDBInstance;
    constructor(name: string, db: InDBInstance) {
        this.name = name;
        this.db = db;
    }

    // 添加
    @SupportIndexedDB()
    public async add(value: any) {
        const transaction = await this.use("readwrite");
        const objectStore = transaction.objectStore(this.name);
        const request = objectStore.add({ ...value });
        return IDBRequest2Promise(request);
    }
    // 删除
    @SupportIndexedDB()
    public async del(value: any) {
        const transaction = await this.use("readwrite");
        const objectStore = transaction.objectStore(this.name);
        const request = objectStore.add({ ...value });
        return IDBRequest2Promise(request);
    }
    @SupportIndexedDB()
    public async put(value: any) {
        const transaction = await this.use("readwrite");
        const objectStore = transaction.objectStore(this.name);
        const request = objectStore.add({ ...value });
        return IDBRequest2Promise(request);
    }
    @SupportIndexedDB()
    public async get(id: number): Promise<StoreType> {
        const transaction = await this.use("readonly");
        const objectStore = transaction.objectStore(this.name);
        const request = objectStore.get(id);
        return IDBRequest2Promise(request);
    }

    @SupportIndexedDB()
    public async *all() {
        let idx = 1;
        while (true) {
            const res = await this.get(idx++);
            if (!res) {
                return null;
            }
            yield res;
        }
    }

    private async use(mode: IDBTransactionMode): Promise<IDBTransaction> {
        return this.db.use(this.name, mode);
    }
}
