import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private counter = 0;
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  private modalCounter = 0;
  private modalLoadingSubject = new BehaviorSubject<boolean>(false);
  modalLoading$ = this.modalLoadingSubject.asObservable();

  begin() {
    this.counter++;
    if (!this.loadingSubject.value) this.loadingSubject.next(true);
  }

  end() {
    if (this.counter > 0) this.counter--;
    if (this.counter === 0 && this.loadingSubject.value) this.loadingSubject.next(false);
  }

  reset() {
    this.counter = 0;
    this.loadingSubject.next(false);
  }

  showModal() {
    this.modalCounter++;
    if (!this.modalLoadingSubject.value) this.modalLoadingSubject.next(true);
  }

  hideModal() {
    if (this.modalCounter > 0) this.modalCounter--;
    if (this.modalCounter === 0 && this.modalLoadingSubject.value) this.modalLoadingSubject.next(false);
  }
}
