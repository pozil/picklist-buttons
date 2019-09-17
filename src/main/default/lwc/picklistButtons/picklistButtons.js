import { LightningElement, track, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getRecord, updateRecord } from 'lightning/uiRecordApi';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';

export default class PicklistRadio extends LightningElement {
    // Page context
    @api recordId;
    @api objectApiName;

    // App Builder parameters
    @api label;
    @api qualifiedFieldName;

    @track recordTypeId;
    @track picklistValue;
    @track buttons = [];
    @track errorMessage;

    hasRecordTypeId;
    defaultRecordTypeId;

    // Extract object information including default record type id
    @wire(getObjectInfo, { objectApiName: '$objectApiName' })
    getObjectInfo({ error, data }) {
        if (data) {
            this.defaultRecordTypeId = data.defaultRecordTypeId;
            // Check if we need to override record type with default
            if (this.hasRecordTypeId === false) {
                this.recordTypeId = this.defaultRecordTypeId;
            } 
        } else if (error) {
            const message = `Failed to retrieve object info. ${this.reduceErrors(error)}`;
            this.errorMessage = message;
        }
    }



    // Extract picklist values
    @wire(getPicklistValues, {
        recordTypeId: '$recordTypeId',
        fieldApiName: '$qualifiedFieldName'
    })
    getPicklistValues({ error, data }) {
        if (data) {
            this.buttons = data.values.map(plValue => {
                return {
                    label: plValue.label,
                    value: plValue.value
                };
            });
        } else if (error) {
            const message = `Failed to retrieve picklist values. ${this.reduceErrors(error)}`;
            this.errorMessage = message;
        }
    }

    // Extract current picklist value for this record
    @wire(getRecord, {
        recordId: '$recordId',
        fields: '$qualifiedFieldName'
    })
    getRecord({ error, data }) {
        if (data) {
            // Check if record data includes record type
            if (data.recordTypeInfo) {
                this.hasRecordTypeId = true;
                this.recordTypeId = data.recordTypeInfo.recordTypeId;
            } else { // Record type is missing from record data
                this.hasRecordTypeId = false;
                // Use default type if available (it could still be loading)
                if (this.defaultRecordTypeId) {
                    this.recordTypeId = this.defaultRecordTypeId;
                }
            }
            // Get current picklist value
            const fieldName = this.getFieldName();
            this.picklistValue = data.fields[fieldName].value;
        } else if (error) {
            const message = `Failed to retrieve record data. ${this.reduceErrors(error)}`;
            this.errorMessage = message;
        }
    }

    handleChange(event) {
        const { value } = event.detail;

        // Prepare updated record fields
        const fieldName = this.getFieldName();
        const fields = {
            Id: this.recordId
        };
        fields[fieldName] = value;
        const recordInput = { fields };
        // Update record
        updateRecord(recordInput)
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Record updated',
                        variant: 'success'
                    })
                );
            })
            .catch(error => {
                const message = this.reduceErrors(error);
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error updating record',
                        message,
                        variant: 'error'
                    })
                );
            });
    }

    getFieldName() {
        return this.qualifiedFieldName.substring(this.qualifiedFieldName.indexOf('.') +1);
    }

    // Simplifies error messages (credit: LWC Recipes sample app - https://github.com/trailheadapps/lwc-recipes)
    reduceErrors(errors) {
        if (!Array.isArray(errors)) {
            errors = [errors];
        }
    
        return (
            errors
                // Remove null/undefined items
                .filter(error => !!error)
                // Extract an error message
                .map(error => {
                    // UI API read errors
                    if (Array.isArray(error.body)) {
                        return error.body.map(e => e.message);
                    }
                    // UI API DML, Apex and network errors
                    else if (error.body && typeof error.body.message === 'string') {
                        return error.body.message;
                    }
                    // JS errors
                    else if (typeof error.message === 'string') {
                        return error.message;
                    }
                    // Unknown error shape so try HTTP status text
                    return error.statusText;
                })
                // Flatten
                .reduce((prev, curr) => prev.concat(curr), [])
                // Remove empty strings
                .filter(message => !!message)
        );
    }
}