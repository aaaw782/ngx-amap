import { Directive, OnInit, Input, AfterContentInit, ContentChildren, QueryList,
  OnDestroy, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { LoggerService } from '../../services/logger';
import { LngLat, Size, Marker, Icon, Pixel, Map } from '../../types/class';
import { IPixel, IIcon, ILabel, MarkerOptions } from '../../types/interface';
import { Utils } from '../../utils/utils';
import { ChangeFilter } from '../../utils/change-filter';
import { MarkerService } from '../../services/marker/marker.service';
import { PixelService } from '../../services/pixel/pixel.service';
import { IconService } from '../../services/icon/icon.service';
import { LabelService } from '../../services/label/label.service';
import { AmapInfoWindowComponent } from '../../components/amap-info-window/amap-info-window.component';

const ALL_OPTIONS = [
  'position',
  'offset',
  'icon',
  'content',
  'topWhenClick',
  'bubble',
  'draggable',
  'raiseOnDrag',
  'cursor',
  'visible',
  'zIndex',
  'angle',
  'autoRotation',
  'shadow',
  'title',
  'clickable',
  'shape',
  'extData',
  'label'
];

@Directive({
  selector: 'amap-marker'
})
export class AmapMarkerDirective implements OnChanges, OnDestroy, AfterContentInit {
  TAG = 'amap-marker';

  // These properties are supported in MarkerOptions:
  @Input() position: LngLat;
  @Input() offset: IPixel;
  @Input() icon: string|IIcon;
  @Input() content: any;
  @Input() topWhenClick: boolean;
  @Input() bubble: boolean;
  @Input() draggable: boolean;
  @Input() raiseOnDrag: boolean;
  @Input() cursor: string;
  @Input() visible: boolean;
  @Input() zIndex: number;
  @Input() angle: number;
  @Input() autoRotation: boolean;
  @Input() shadow: IIcon;
  @Input() title: string;
  @Input() clickable: boolean;
  @Input() shape: any;  // TODO: MarkerShape
  @Input() extData: any;
  @Input() label: ILabel;

  // Extra property:
  @Input() isTop: boolean;
  @Input() animation: string;
  @Input() hidden = false;
  @Input() openInfoWindow = true;

  // amap-marker events:
  @Output() markerReady = new EventEmitter();
  @Output() markerClick = new EventEmitter();
  @Output() moving = new EventEmitter();
  @Output() moveend = new EventEmitter();
  @Output() movealong = new EventEmitter();

  // amap-info-window:
  @ContentChildren(AmapInfoWindowComponent) infoWindowComponent = new QueryList<AmapInfoWindowComponent>();

  private _marker: Promise<Marker>;
  private _subscriptions: Subscription;

  constructor(
    private logger: LoggerService,
    private markers: MarkerService,
    private pixel: PixelService,
    private icons: IconService,
    private labels: LabelService
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    const filter = ChangeFilter.of(changes);

    if (!this._marker) {
      const options = Utils.getOptionsFor<MarkerOptions>(this, ALL_OPTIONS);
      this._marker = this.markers.create(options);
      this.bindEvents();
      this._marker.then(marker => this.markerReady.emit(marker));
    } else {
      filter.has<string|IIcon>('icon').subscribe(v => this.setIcon(v));
      filter.has<IIcon>('shadow').subscribe(v => this.setShadow(v));
      filter.has<ILabel>('label').subscribe(v => this.setLabel(v));
      filter.has<string>('title').subscribe(v => this.setTitle(v));
      filter.has<any>('content').subscribe(v => this.setContent(v));
      filter.has<any>('extData').subscribe(v => this.setExtData(v));
      filter.has<boolean>('clickable').subscribe(v => this.setClickable(!!v));
      filter.has<boolean>('draggable').subscribe(v => this.setDraggable(!!v));
      filter.has<any>('visible').subscribe(v => v ? this.show() : this.hide());
      filter.has<string>('cursor').subscribe(v => this.setCursor(v));
      filter.has<string>('animation').subscribe(v => this.setAnimation(v));
      filter.has<number>('angle').subscribe(v => this.setAngle(v));
      filter.has<number>('zIndex').subscribe(v => this.setzIndex(v));
      filter.has<any>('shape').subscribe(v => this.setShape(v));
      filter.notEmpty<IPixel>('offset').subscribe(v => this.setOffset(v));
      filter.notEmpty<LngLat>('position').subscribe(v => this.setPosition(v));
    }

    filter.has<boolean>('isTop').subscribe(v => this.setTop(!!v));
    filter.has<boolean>('hidden').subscribe(v => v ? this.hide() : this.show());
  }

  ngOnDestroy() {
    this._subscriptions.unsubscribe();
    this.markers.destroy(this._marker);
  }

  ngAfterContentInit() {
    this.updateInfoWindow();
    this.infoWindowComponent.changes.subscribe(() => this.updateInfoWindow());
  }

  private updateInfoWindow() {
    if (this.infoWindowComponent.length > 1) {
      this.logger.e(this.TAG, 'Expected no more than 1 info window.');
      return;
    }

    this.infoWindowComponent.forEach(component => {
      component.hostMarker = this._marker;
    });
  }

  private bindEvents() {
    this._subscriptions = this.markers.bindEvent(this._marker, 'click').subscribe(e => {
      if (this.openInfoWindow) {
        this.infoWindowComponent.forEach(component => {
          component.open();
        });
      }
      this.markerClick.emit(e);
    });
    this._subscriptions.add(this.markers.bindEvent(this._marker, 'moving').subscribe(e => {
      this.moving.emit(e);
    }));
    this._subscriptions.add(this.markers.bindEvent(this._marker, 'moveend').subscribe(e => {
      this.moveend.emit(e);
    }));
    this._subscriptions.add(this.markers.bindEvent(this._marker, 'movealong').subscribe(e => {
      this.movealong.emit(e);
    }));
  }

  show(): Promise<void> {
    return this._marker.then(m => m.show());
  }

  hide(): Promise<void> {
    return this._marker.then(m => m.hide());
  }

  // Animations
  moveTo(position: LngLat, speed: number, f?: (k: any) => any): Promise<void> {
    return this._marker.then(marker => marker.moveTo(position, speed, f));
  }

  moveAlong(path: LngLat[], speed: number, f?: (k: any) => any): Promise<void> {
    return this._marker.then(marker => marker.moveAlong(path, speed, f));
  }

  stopMove(): Promise<void> {
    return this._marker.then(marker => marker.stopMove());
  }

  pauseMove(): Promise<void> {
    return this._marker.then(marker => marker.pauseMove());
  }

  resumeMove(): Promise<void> {
    return this._marker.then(marker => marker.resumeMove());
  }

  // Setters
  setOffset(offset: IPixel): Promise<void> {
    return this._marker.then(marker => {
      const value = this.pixel.create(offset, 'offset');
      if (value) {
        marker.setOffset(value);
      }
    });
  }

  setIcon(icon: string|IIcon): Promise<void> {
    return this._marker.then(marker => {
      const value = this.icons.create(icon, 'icon');
      marker.setIcon(value);
    });
  }

  setShadow(shadow: IIcon): Promise<void> {
    return this._marker.then(marker => {
      const value = <Icon>this.icons.create(shadow, 'shadow');
      marker.setShadow(value);
    });
  }

  setLabel(label: ILabel): Promise<void> {
    return this._marker.then(marker => {
      const value = this.labels.create(label, 'label');
      marker.setLabel(value);
    });
  }

  setDraggable(draggable: boolean): Promise<void> {
    return this._marker.then(marker => marker.setDraggable(draggable));
  }

  setClickable(clickable: boolean): Promise<void> {
    return this._marker.then(marker => marker.setClickable(clickable));
  }

  setPosition(position: LngLat): Promise<void> {
    return this._marker.then(marker => marker.setPosition(position));
  }

  setAngle(angle: number): Promise<void> {
    return this._marker.then(marker => marker.setAngle(angle));
  }

  setzIndex(zIndex: number): Promise<void> {
    return this._marker.then(marker => marker.setzIndex(zIndex));
  }

  setContent(content: any): Promise<void> {
    return this._marker.then(marker => marker.setContent(content));
  }

  setTitle(title: string): Promise<void> {
    return this._marker.then(marker => marker.setTitle(title));
  }

  setCursor(cursor: string): Promise<void> {
    return this._marker.then(marker => marker.setCursor(cursor));
  }

  setTop(isTop: boolean): Promise<void> {
    return this._marker.then(marker => marker.setTop(isTop));
  }

  setExtData(data: any): Promise<void> {
    return this._marker.then(marker => marker.setExtData(data));
  }

  setShape(shape: any): Promise<void> {
    return this._marker.then(marker => marker.setShape(shape));
  }

  setAnimation(animation: string): Promise<void> {
    return this._marker.then(marker => marker.setAnimation(animation));
  }

  // Getters
  getOffset(): Promise<Pixel> {
    return this._marker.then(marker => marker.getOffset());
  }

  getPosition(): Promise<LngLat> {
    return this._marker.then(marker => marker.getPosition());
  }

  getLabel(): Promise<any> {
    return this._marker.then(marker => marker.getLabel());
  }

  getAngle(): Promise<number> {
    return this._marker.then(marker => marker.getAngle());
  }

  getzIndex(): Promise<number> {
    return this._marker.then(marker => marker.getzIndex());
  }

  getIcon(): Promise<string|Icon> {
    return this._marker.then(marker => marker.getIcon());
  }

  getContent(): Promise<any> {
    return this._marker.then(marker => marker.getContent());
  }

  getTitle(): Promise<string> {
    return this._marker.then(marker => marker.getTitle());
  }

  getTop(): Promise<boolean> {
    return this._marker.then(marker => marker.getTop());
  }

  getShadow(): Promise<Icon> {
    return this._marker.then(marker => marker.getShadow());
  }

  getShape(): Promise<any> {
    return this._marker.then(marker => marker.getShape());
  }

  getExtData(): Promise<any> {
    return this._marker.then(marker => marker.getExtData());
  }

  getMap(): Promise<Map> {
    return this._marker.then(marker => marker.getMap());
  }

  getAnimation(): Promise<string> {
    return this._marker.then(marker => marker.getAnimation());
  }

  getClickable(): Promise<boolean> {
    return this._marker.then(marker => marker.getClickable());
  }

  getDraggable(): Promise<boolean> {
    return this._marker.then(marker => marker.getDraggable());
  }
}
