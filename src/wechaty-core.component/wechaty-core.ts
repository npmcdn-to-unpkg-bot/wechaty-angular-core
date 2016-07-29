import {
  Component
  , Inject
  , OnInit
  , OnDestroy
  , EventEmitter
  , Input
  , Output
  , NgZone
  , Injector
} from '@angular/core'

import {
  Observable
  , Subject
  , Subscription
} from 'rxjs/Rx'

import { Brolog } from 'brolog'

import { IoService, IoEvent } from '../io.service/index'

/**
 * for payload
 */
export interface ScanInfo {
  url: string
  code: number
}

export interface UserInfo {
  uin: number
  name: string
  remark: string
  sex: number
  signature: string
}

@Component({
  moduleId: module.id
  , selector: 'wechaty-core'
  , templateUrl: 'wechaty-core.html'
  , styleUrls: ['wechaty-core.css']
})

export class WechatyCoreComponent implements OnInit, OnDestroy {
  @Output() message   = new EventEmitter<string>()
  @Output() scan      = new EventEmitter<ScanInfo>()
  @Output() login     = new EventEmitter<UserInfo>()
  @Output() logout    = new EventEmitter<UserInfo>()
  @Output() error     = new EventEmitter<any>()
  @Output() heartbeat = new EventEmitter<any>()

  @Input() token: string = ''

  private timer: Observable<any>
  private timerSub: Subscription
  private ioSubscription: any
  private ender: Subject<any>

  private ioService: IoService

  counter = 0

  constructor(
    private ngZone: NgZone
    , private log: Brolog
    , private injector: Injector
  ) {
    this.log.verbose('Wechaty', 'constructor()')
  }

  ngOnInit() {
    this.log.verbose('Wechaty', 'ngOninit() with token: ' + this.token)

    /**
     * IoService must be put inside OnInit
     * because it used @Input(token)
     * which is not inittialized in constructor()
     */
    const ioService = this.ioService = new IoService(
      this.token
      , this.injector
    )
    ioService.start()

    this.ioSubscription = ioService.io()
                          .subscribe(this.onIo.bind(this))

    // this.startTimer()
  }

  ngOnDestroy() {
    this.log.verbose('Wechaty', 'ngOnDestroy()')

    this.endTimer()

    if (this.ioSubscription) {
      this.ioSubscription.unsubscribe()
      this.ioSubscription = null
    }
    
    this.ioService.stop()
    this.ioService = null
  }

  private onIo(e: IoEvent) {
    this.log.silly('Wechaty', 'onIo#%d(%s)', this.counter++, e.name)

    switch(e.name) {
      case 'scan':
        this.scan.emit(e.payload as ScanInfo)
        break
      case 'login':
        this.login.emit(e.payload as UserInfo)
        break
      case 'logout':
        this.logout.emit(e.payload as UserInfo)
        break
      case 'message':
        this.message.emit(e.payload)
        break
      case 'error':
        this.error.emit(e.payload)
        break

      case 'ding':
      case 'dong':
      case 'raw':
        this.heartbeat.emit(e.name + '[' + e.payload + ']')
        break
      case 'heartbeat':
        this.heartbeat.emit(e.payload)
        break

      case 'sys':
        this.log.silly('Wechaty', 'onIo(%s): %s', e.name, e.payload)
        break

      default:
        this.log.warn('Wechaty', 'onIo() unknown event name: %s[%s]', e.name, e.payload)
        break
    }
  }

  reset(reason) {
    this.log.verbose('Wechaty', 'reset(%s)', reason)

    const resetEvent: IoEvent = {
      name: 'reset'
      , payload: reason
    }
    this.ioService.io()
        .next(resetEvent)
  }

  shutdown(reason) {
    this.log.verbose('Wechaty', 'shutdown(%s)', reason)

    const shutdownEvent: IoEvent = {
      name: 'shutdown'
      , payload: reason
    }
    this.ioService.io()
        .next(shutdownEvent)
  }

  private startTimer() {
    this.log.verbose('Wechaty', 'startTimer()')
    this.ender = new Subject()

    // https://github.com/angular/protractor/issues/3349#issuecomment-232253059
    // https://github.com/juliemr/ngconf-2016-zones/blob/master/src/app/main.ts#L38
    this.ngZone.runOutsideAngular(() => {
      this.timer = Observable.interval(3000)
          .do(i => { this.log.verbose('do', ' %d', i) })
          .takeUntil(this.ender)
          // .publish()
          .share()
    })

    this.timerSub = this.timer.subscribe(t => {
      this.counter = t

      this.ioService.ding(this.counter)
      // this.message.emit('#' + this.token + ':' + dong)
    })

  }

  private endTimer() {
    this.log.verbose('Wechaty', 'endTimer()')

    if (this.timerSub) {
      this.timerSub.unsubscribe()
      this.timerSub = null
    }
    this.timer = null

    if (this.ender) {
      this.ender.next(null)
      this.ender = null
    }
  }

}